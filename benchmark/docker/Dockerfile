FROM node:24-bookworm

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl git openjdk-17-jdk && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.2"
RUN install -m 0755 /root/.bun/bin/bun /usr/local/bin/bun

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

RUN node --version && bun --version && java -version
