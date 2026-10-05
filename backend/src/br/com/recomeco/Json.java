package br.com.recomeco;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Parser e serializador JSON minimalista (sem dependências externas).
 * Converte para Map, List, String, Double, Boolean e null.
 */
public final class Json {

    private final String src;
    private int pos;

    private Json(String src) {
        this.src = src;
    }

    public static Object parse(String text) {
        Json p = new Json(text == null ? "" : text.trim());
        Object value = p.readValue();
        p.skipWhitespace();
        if (p.pos != p.src.length()) {
            throw new IllegalArgumentException("JSON inválido: conteúdo extra na posição " + p.pos);
        }
        return value;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> parseObject(String text) {
        Object o = parse(text);
        if (!(o instanceof Map)) throw new IllegalArgumentException("Esperado um objeto JSON");
        return (Map<String, Object>) o;
    }

    private Object readValue() {
        skipWhitespace();
        if (pos >= src.length()) throw new IllegalArgumentException("JSON inesperadamente vazio");
        char c = src.charAt(pos);
        switch (c) {
            case '{': return readObject();
            case '[': return readArray();
            case '"': return readString();
            case 't': expect("true"); return Boolean.TRUE;
            case 'f': expect("false"); return Boolean.FALSE;
            case 'n': expect("null"); return null;
            default: return readNumber();
        }
    }

    private Map<String, Object> readObject() {
        Map<String, Object> map = new LinkedHashMap<>();
        pos++; // {
        skipWhitespace();
        if (peek() == '}') { pos++; return map; }
        while (true) {
            skipWhitespace();
            String key = readString();
            skipWhitespace();
            if (peek() != ':') throw new IllegalArgumentException("Esperado ':' na posição " + pos);
            pos++;
            map.put(key, readValue());
            skipWhitespace();
            char c = peek();
            pos++;
            if (c == '}') return map;
            if (c != ',') throw new IllegalArgumentException("Esperado ',' ou '}' na posição " + pos);
        }
    }

    private List<Object> readArray() {
        List<Object> list = new ArrayList<>();
        pos++; // [
        skipWhitespace();
        if (peek() == ']') { pos++; return list; }
        while (true) {
            list.add(readValue());
            skipWhitespace();
            char c = peek();
            pos++;
            if (c == ']') return list;
            if (c != ',') throw new IllegalArgumentException("Esperado ',' ou ']' na posição " + pos);
        }
    }

    private String readString() {
        if (peek() != '"') throw new IllegalArgumentException("Esperado '\"' na posição " + pos);
        pos++;
        StringBuilder sb = new StringBuilder();
        while (pos < src.length()) {
            char c = src.charAt(pos++);
            if (c == '"') return sb.toString();
            if (c == '\\') {
                char e = src.charAt(pos++);
                switch (e) {
                    case '"': sb.append('"'); break;
                    case '\\': sb.append('\\'); break;
                    case '/': sb.append('/'); break;
                    case 'b': sb.append('\b'); break;
                    case 'f': sb.append('\f'); break;
                    case 'n': sb.append('\n'); break;
                    case 'r': sb.append('\r'); break;
                    case 't': sb.append('\t'); break;
                    case 'u':
                        sb.append((char) Integer.parseInt(src.substring(pos, pos + 4), 16));
                        pos += 4;
                        break;
                    default: throw new IllegalArgumentException("Escape inválido: \\" + e);
                }
            } else {
                sb.append(c);
            }
        }
        throw new IllegalArgumentException("String não terminada");
    }

    private Double readNumber() {
        int start = pos;
        while (pos < src.length() && "+-0123456789.eE".indexOf(src.charAt(pos)) >= 0) pos++;
        if (start == pos) throw new IllegalArgumentException("Valor inesperado na posição " + pos);
        return Double.parseDouble(src.substring(start, pos));
    }

    private void expect(String word) {
        if (!src.startsWith(word, pos)) throw new IllegalArgumentException("Esperado " + word);
        pos += word.length();
    }

    private char peek() {
        return pos < src.length() ? src.charAt(pos) : '\0';
    }

    private void skipWhitespace() {
        while (pos < src.length() && Character.isWhitespace(src.charAt(pos))) pos++;
    }

    // ---------------------------------------------------------------- serialização

    public static String stringify(Object value) {
        StringBuilder sb = new StringBuilder();
        write(sb, value);
        return sb.toString();
    }

    private static void write(StringBuilder sb, Object v) {
        if (v == null) {
            sb.append("null");
        } else if (v instanceof String s) {
            writeString(sb, s);
        } else if (v instanceof Number n) {
            double d = n.doubleValue();
            if (d == Math.rint(d) && !Double.isInfinite(d) && Math.abs(d) < 1e15) sb.append((long) d);
            else sb.append(d);
        } else if (v instanceof Boolean) {
            sb.append(v);
        } else if (v instanceof Map<?, ?> m) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                writeString(sb, String.valueOf(e.getKey()));
                sb.append(':');
                write(sb, e.getValue());
            }
            sb.append('}');
        } else if (v instanceof Iterable<?> it) {
            sb.append('[');
            boolean first = true;
            for (Object o : it) {
                if (!first) sb.append(',');
                first = false;
                write(sb, o);
            }
            sb.append(']');
        } else {
            writeString(sb, v.toString());
        }
    }

    private static void writeString(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20 || c == '<' || c == '>') sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        sb.append('"');
    }
}
