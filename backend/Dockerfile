# D1: one parameterized Dockerfile builds any of the 9 services.
# Used by docker-compose with:  build: { context: ./backend, args: { MODULE: auth-service } }
#
# Build stage — full multi-module Maven build of just the requested module (+ parent).
FROM maven:3.9-eclipse-temurin-21 AS build
ARG MODULE
WORKDIR /build

# Copy poms first so dependency downloads are cached between builds
COPY pom.xml .
COPY eureka-server/pom.xml eureka-server/
COPY api-gateway/pom.xml api-gateway/
COPY auth-service/pom.xml auth-service/
COPY worker-service/pom.xml worker-service/
COPY booking-service/pom.xml booking-service/
COPY payment-service/pom.xml payment-service/
COPY review-service/pom.xml review-service/
COPY notification-service/pom.xml notification-service/
COPY admin-service/pom.xml admin-service/
RUN mvn -q -pl ${MODULE} -am dependency:go-offline || true

# Now copy sources and build the module
COPY . .
RUN mvn -q -pl ${MODULE} -am package -DskipTests

# Runtime stage — slim JRE
FROM eclipse-temurin:21-jre-alpine
ARG MODULE
WORKDIR /app
COPY --from=build /build/${MODULE}/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
