package com.lifequest;

import com.lifequest.domain.User;
import com.lifequest.repository.QuestRepository;
import com.lifequest.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "server.port=0", "spring.datasource.url=${DB_TEST_URL}", "lifequest.seed-user=false"
})
@EnabledIfEnvironmentVariable(named = "DB_TEST_URL", matches = ".+")
class QuestApiTest {
    @Value("${local.server.port}") int port;
    @Autowired UserRepository users;
    @Autowired QuestRepository quests;
    final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    final ObjectMapper json = new ObjectMapper();
    Long userId;

    @BeforeEach void setUp() {
        User user = new User();
        user.setUsername("test-" + UUID.randomUUID());
        userId = users.saveAndFlush(user).getId();
    }
    @AfterEach void cleanUp() {
        quests.deleteAll(quests.findAllByUserIdOrderByCreatedAtAscIdAsc(userId));
        users.deleteById(userId);
    }
    HttpRequest request(String method, String path, String body) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
            .timeout(Duration.ofSeconds(20)).header("Content-Type", "application/json")
            .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build();
    }
    HttpResponse<String> send(String method, String path, String body) throws Exception {
        return client.send(request(method, path, body), HttpResponse.BodyHandlers.ofString());
    }
    JsonNode body(HttpResponse<String> response) { return json.readTree(response.body()); }
    String payload(String difficulty) {
        return "{\"userId\":" + userId + ",\"title\":\"  통합 테스트  \",\"category\":\"개발\",\"difficulty\":\"" + difficulty + "\"}";
    }
    long create(String difficulty) throws Exception {
        var result = send("POST", "/api/quests", payload(difficulty));
        assertEquals(201, result.statusCode(), result.body());
        assertEquals("통합 테스트", body(result).get("title").asText());
        return body(result).get("id").asLong();
    }
    JsonNode user() throws Exception { return body(send("GET", "/api/users/" + userId, null)); }

    @Test void createUpdateListDeleteAndStaticPage() throws Exception {
        long id = create("쉬움");
        var updated = send("PUT", "/api/quests/" + id,
            "{\"title\":\"변경한 제목\",\"category\":\"독서\",\"difficulty\":\"보통\"}");
        assertEquals(200, updated.statusCode());
        assertEquals(30, body(updated).get("rewardExp").asInt());
        var list = body(send("GET", "/api/quests?userId=" + userId, null));
        assertEquals(1, list.size());
        assertEquals("변경한 제목", list.get(0).get("title").asText());
        assertEquals(204, send("DELETE", "/api/quests/" + id, null).statusCode());
        assertEquals(0, body(send("GET", "/api/quests?userId=" + userId, null)).size());
        assertTrue(send("GET", "/", null).body().contains("LifeQuest"));
        assertEquals(200, send("GET", "/api.js", null).statusCode());
        var health = send("GET", "/api/health", null);
        assertEquals(200, health.statusCode());
        assertEquals("UP", body(health).get("status").asText());
    }
    @Test void completionIsIdempotentAndDeletionKeepsEarnedExperience() throws Exception {
        long id = create("어려움");
        for (int i=0;i<2;i++) assertEquals(200, send("POST", "/api/quests/"+id+"/complete", null).statusCode());
        assertEquals(50, user().get("exp").asInt());
        assertEquals(1, user().get("level").asInt());
        assertEquals(204, send("DELETE", "/api/quests/"+id, null).statusCode());
        assertEquals(50, user().get("exp").asInt());
    }
    @Test void concurrentDuplicateCompletionOnlyRewardsOnce() throws Exception {
        long id=create("어려움");
        var requests = new ArrayList<java.util.concurrent.CompletableFuture<HttpResponse<String>>>();
        for(int i=0;i<8;i++) requests.add(client.sendAsync(request("POST", "/api/quests/"+id+"/complete", null), HttpResponse.BodyHandlers.ofString()));
        for(var response:requests) assertEquals(200, response.join().statusCode());
        assertEquals(50, user().get("exp").asInt());
    }
    @Test void concurrentDifferentQuestsPreserveRewardsAndLevelUp() throws Exception {
        long first=create("어려움"), second=create("어려움");
        var a=client.sendAsync(request("POST", "/api/quests/"+first+"/complete",null),HttpResponse.BodyHandlers.ofString());
        var b=client.sendAsync(request("POST", "/api/quests/"+second+"/complete",null),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,a.join().statusCode()); assertEquals(200,b.join().statusCode());
        assertEquals(2,user().get("level").asInt()); assertEquals(0,user().get("exp").asInt());
    }
    @Test void completedDifficultyChangeReturnsConflictWithoutChangingReward() throws Exception {
        long id=create("쉬움"); send("POST","/api/quests/"+id+"/complete",null);
        assertEquals(409,send("PUT","/api/quests/"+id,payload("어려움")).statusCode());
        assertEquals(200,send("PUT","/api/quests/"+id,payload("쉬움")).statusCode());
        assertEquals(10,user().get("exp").asInt());
    }
    @Test void invalidRequestsAndMissingResourcesAreRejected() throws Exception {
        assertEquals(400,send("POST","/api/quests",payload("매우어려움")).statusCode());
        assertEquals(400,send("POST","/api/quests",payload("보통").replace("통합 테스트","  ")).statusCode());
        assertEquals(400,send("POST","/api/quests",payload("보통").replace("개발","<img src=x>")).statusCode());
        assertEquals(400,send("POST","/api/quests","{").statusCode());
        assertEquals(404,send("GET","/api/users/9223372036854775807",null).statusCode());
        assertEquals(404,send("POST","/api/quests/9223372036854775807/complete",null).statusCode());
        assertEquals(0,body(send("GET","/api/quests?userId="+userId,null)).size());
    }
}
