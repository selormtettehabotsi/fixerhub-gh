# syntax=docker/dockerfile:1.7
# D1: one parameterized Dockerfile builds any of the 9 services.
# Used by docker-compose with:  build: { context: ./backend, args: { MODULE: auth-service } }
#
# NOTE ON THE ~/.m2 CACHE MOUNT (below): `compose --profile app up --build`
# builds all 9 images at once. Without a shared cache each one downloaded the
# entire dependency tree into its own layer — nine simultaneous full downloads,
# which is enough to swamp Docker Desktop's DNS and fail the build with
# "Temporary failure in name resolution". The cache mount downloads each
# artifact once and shares it across every service and every rebuild.
#
# sharing=locked, not the default "shared": Maven's local repository is not
# safe for concurrent writers, so parallel builds could otherwise read a
# half-written jar. Locking makes the nine builds queue for the Maven step —
# slower on paper, but far faster than nine cold downloads, and reliable.
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
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn -q -pl ${MODULE} -am dependency:go-offline || true

# Now copy sources and build the module
COPY . .
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn -q -pl ${MODULE} -am package -DskipTests

# Runtime stage — slim JRE
FROM eclipse-temurin:21-jre-alpine
ARG MODULE
WORKDIR /app
COPY --from=build /build/${MODULE}/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
