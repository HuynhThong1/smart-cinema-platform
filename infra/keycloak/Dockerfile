FROM quay.io/keycloak/keycloak:26.3.3 AS builder
ENV KC_DB=postgres KC_HEALTH_ENABLED=true KC_METRICS_ENABLED=true
WORKDIR /opt/keycloak
RUN bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.3.3
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realm.json /opt/keycloak/data/import/smart-cinema-realm.json
ENV KC_DB=postgres KC_HEALTH_ENABLED=true KC_METRICS_ENABLED=true
EXPOSE 10000 9000
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
