FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY backend/pom.xml backend/pom.xml
RUN mvn -B -f backend/pom.xml dependency:go-offline
COPY backend/src backend/src
COPY dist dist
RUN mvn -B -f backend/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/backend/target/lifequest-1.0.0.jar app.jar
ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -Duser.timezone=Asia/Seoul"
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
