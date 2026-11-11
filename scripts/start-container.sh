#!/bin/sh
set -eu

# Aiven's project CA is supplied through the hosting provider's environment.
# Without it, the JVM keeps its ordinary trust configuration (e.g. Railway).
if [ -n "${DB_SSL_CA_PEM:-}" ]; then
    cert_dir=$(mktemp -d)
    chmod 700 "$cert_dir"
    printf '%s\n' "$DB_SSL_CA_PEM" > "$cert_dir/ca.pem"
    keytool -importcert -noprompt -alias database-ca \
        -file "$cert_dir/ca.pem" -keystore "$cert_dir/truststore.p12" \
        -storetype PKCS12 -storepass changeit >/dev/null 2>&1
    rm -f "$cert_dir/ca.pem"
    export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Djavax.net.ssl.trustStore=$cert_dir/truststore.p12 -Djavax.net.ssl.trustStorePassword=changeit"
fi

exec java -jar /app/app.jar
