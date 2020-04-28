FROM frolvlad/alpine-glibc:alpine-3.11_glibc-2.31 AS build

WORKDIR /app

RUN apk add --virtual .download --no-cache curl \
    && curl -fsSL https://github.com/denoland/deno/releases/download/v0.41.0/deno-x86_64-unknown-linux-gnu.zip \
    --output deno.zip \
    && unzip deno.zip \
    && chmod 777 deno \
    && mv deno /bin/deno \
    && addgroup -g 1993 -S deno \
    && adduser -u 1993 -S deno -G deno \
    && mkdir -p /deno-dir cached-imports src templates/workers \
    && chown deno:deno /deno-dir

ENV DENO_DIR /deno-dir

COPY cached-imports cached-imports/
COPY src src/

RUN deno cache src/main.ts --importmap cached-imports/imports.json
# for debugging
# RUN cd $DENO_DIR && ls -la && CACHEBUST=$(date +%s)

FROM frolvlad/alpine-glibc:alpine-3.11_glibc-2.31

WORKDIR /app

ENV DENO_DIR /deno-dir

RUN mkdir -p /deno-dir src /tmp/archive

COPY --from=build /deno-dir /deno-dir/
COPY --from=build /bin/deno /bin/deno
COPY --from=build app/src src/

RUN apk add --no-cache tar \
    && addgroup -g 1993 -S deno \
    && adduser -u 1993 -S deno -G deno \
    && chown deno:deno /deno-dir/


EXPOSE 8080

CMD ["deno", "-A", "--allow-net=:8080", "src/main.ts"]
