package br.com.recomeco;

/** Erro de entrada do usuário — vira resposta HTTP 400. */
public class ValidacaoException extends RuntimeException {
    public ValidacaoException(String message) {
        super(message);
    }
}
