# ============================================================
# MCP-SUPERSERVER - Neo4j Custom Dockerfile
# ============================================================
# Optimized Neo4j configuration for MCP memory backend

FROM neo4j:5.15.0-community

LABEL maintainer="MCP-SUPERSERVER"
LABEL description="Neo4j graph database for structured AI memory"

# Install APOC plugin
RUN curl -L https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/5.15.0/apoc-5.15.0-all.jar \
    -o /var/lib/neo4j/plugins/apoc-5.15.0-all.jar && \
    chmod 644 /var/lib/neo4j/plugins/apoc-5.15.0-all.jar

# Copy custom configuration
COPY conf/neo4j.conf /var/lib/neo4j/conf/neo4j.conf

# Create data directories
RUN mkdir -p /data /logs && \
    chown -R neo4j:neo4j /data /logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=60s \
    CMD cypher-shell -u neo4j -p "${NEO4J_AUTH:-neo4j/neo4j}" "RETURN 1" || exit 1

# Expose ports
EXPOSE 7474 7687

# Set default variables
ENV NEO4J_AUTH=neo4j/change_me_in_production \
    NEO4J_PLUGINS=[\"apoc\"] \
    NEO4J_dbms_memory_heap_initial__size=512m \
    NEO4J_dbms_memory_heap_max__size=2G \
    NEO4J_dbms_memory_pagecache_size=1g \
    NEO4J_dbms_security_procedures_unrestricted=apoc.* \
    NEO4J_dbms_security_procedures_allowlist=apoc.* \
    NEO4J_dbms_connector_bolt_advertised__address=:7687 \
    NEO4J_dbms_connector_http_advertised__address=:7474

CMD ["neo4j"]
