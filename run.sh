#!/usr/bin/env sh
cd "$(dirname "$0")"
mkdir -p backend/out
javac -encoding UTF-8 -d backend/out backend/src/br/com/recomeco/*.java || exit 1
java -cp backend/out br.com.recomeco.Main frontend data
