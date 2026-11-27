package com.lifequest;

import com.lifequest.domain.User;
import com.lifequest.api.AdminController;
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
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    final HttpClient client = HttpClient.newBuilder().cookieHandler(new java.net.CookieManager()).connectTimeout(Duration.ofSeconds(5)).build();
    final ObjectMapper json = new ObjectMapper();
    Long userId;

    @BeforeEach void setUp() throws Exception {
        User user = new User();
        user.setUsername("test-" + UUID.randomUUID());
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("Password1"));
        userId = users.saveAndFlush(user).getId();
        assertEquals(200, send("POST", "/api/auth/login", json.writeValueAsString(Map.of("email", user.getEmail(), "password", "Password1"))).statusCode());
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
        return "{\"title\":\"  통합 테스트  \",\"category\":\"개발\",\"difficulty\":\"" + difficulty + "\"}";
    }
    long create(String difficulty) throws Exception {
        var result = send("POST", "/api/quests", payload(difficulty));
        assertEquals(201, result.statusCode(), result.body());
        assertEquals("통합 테스트", body(result).get("title").asText());
        return body(result).get("id").asLong();
    }
    JsonNode user() throws Exception { return body(send("GET", "/api/users/" + userId, null)); }

    @Test void adminOverviewRequiresAuthenticationAndConfiguredAccount() throws Exception {
        String path = "/api/admin/overview";
        assertEquals(401, HttpClient.newHttpClient().send(request("GET", path, null),
            HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(403, send("GET", path, null).statusCode());

        var session = new org.springframework.mock.web.MockHttpSession();
        session.setAttribute("userId", userId);
        var response = new AdminController(userId, users, quests).overview(session);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertEquals(users.count(), response.getBody().users());
        assertEquals(quests.count(), response.getBody().quests());
        assertEquals(quests.countByCompletedTrue(), response.getBody().completedQuests());
    }

    @Test void adminDirectoryFiltersAccountsAndCountsTheirQuests() throws Exception {
        assertEquals(403, send("GET", "/api/admin/users", null).statusCode());
        long completed = create("어려움");
        create("쉬움");
        assertEquals(200, send("POST", "/api/quests/" + completed + "/complete", null).statusCode());

        var session = new org.springframework.mock.web.MockHttpSession();
        session.setAttribute("userId", userId);
        var admin = new AdminController(userId, users, quests);
        var account = users.findById(userId).orElseThrow();
        var response = admin.directory(session, account.getEmail().toUpperCase(Locale.ROOT), 0);
        assertEquals("no-store", response.getHeaders().getCacheControl());
        var directory = response.getBody();
        assertEquals(1, directory.totalAccounts());
        var row = directory.accounts().getFirst();
        assertEquals(userId.longValue(), row.id());
        assertEquals(50, row.totalExp());
        assertEquals(2, row.quests());
        assertEquals(1, row.completedQuests());
        assertTrue(admin.directory(session, account.getUsername(), 1).getBody().accounts().isEmpty());
    }

    @Test void rememberedLoginSurvivesSessionLossAndLogoutRevokesIt() throws Exception {
        User user = users.findById(userId).orElseThrow();
        String login = json.writeValueAsString(Map.of("email", user.getEmail(), "password", "Password1", "remember", true));
        var response = send("POST", "/api/auth/login", login);
        assertEquals(200, response.statusCode());
        String cookie = response.headers().allValues("Set-Cookie").stream()
            .filter(value -> value.startsWith("lifequest_remember=") && value.contains("Max-Age=2592000"))
            .findFirst().orElseThrow();
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("SameSite=Lax"));
        String token = cookie.substring(0, cookie.indexOf(';'));
        HttpClient fresh = HttpClient.newHttpClient();
        var me = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/auth/me?rememberedOnly=true")).header("Cookie",token).GET().build();
        assertEquals(200, fresh.send(me, HttpResponse.BodyHandlers.ofString()).statusCode());
        var logout = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/auth/logout")).header("Cookie",token).POST(HttpRequest.BodyPublishers.noBody()).build();
        assertEquals(200, fresh.send(logout, HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(401, fresh.send(me, HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM remember_tokens WHERE user_id=?", Integer.class, userId));
    }

    @Test void ordinaryLoginDoesNotIssuePersistentCookie() throws Exception {
        User user = users.findById(userId).orElseThrow();
        var response = send("POST", "/api/auth/login", json.writeValueAsString(Map.of("email", user.getEmail(), "password", "Password1")));
        assertEquals(200, response.statusCode());
        assertTrue(response.headers().allValues("Set-Cookie").stream().noneMatch(value -> value.startsWith("lifequest_remember=") && value.contains("Max-Age=2592000")));
        assertEquals(200, send("GET", "/api/auth/me", null).statusCode());
        assertEquals(401, send("GET", "/api/auth/me?rememberedOnly=true", null).statusCode());
    }

    @Test void expiredRememberCookieCannotRestoreSession() throws Exception {
        User user = users.findById(userId).orElseThrow();
        var response = send("POST", "/api/auth/login", json.writeValueAsString(Map.of("email", user.getEmail(), "password", "Password1", "remember", true)));
        String cookie = response.headers().allValues("Set-Cookie").stream().filter(value -> value.startsWith("lifequest_remember=") && value.contains("Max-Age=2592000")).findFirst().orElseThrow();
        jdbc.update("UPDATE remember_tokens SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE user_id=?", userId);
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/auth/me")).header("Cookie", cookie.substring(0, cookie.indexOf(';'))).GET().build();
        assertEquals(401, HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString()).statusCode());
    }

    @Test void repeatedLoginFailuresAreThrottled() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        String credentials = json.writeValueAsString(Map.of("name", "Explorer", "email", email, "password", "Password1!"));
        String wrong = json.writeValueAsString(Map.of("email", email, "password", "Wrong123!"));
        try {
            assertEquals(201, send("POST", "/api/auth/signup", credentials).statusCode());
            assertEquals(200, send("POST", "/api/auth/logout", null).statusCode());
            for (int attempt = 0; attempt < 5; attempt++) {
                assertEquals(401, send("POST", "/api/auth/login", wrong).statusCode());
            }
            var blocked = send("POST", "/api/auth/login", wrong);
            assertEquals(429, blocked.statusCode(), blocked.body());
            assertEquals(429, send("POST", "/api/auth/login", credentials).statusCode());
            String other = UUID.randomUUID() + "@example.com";
            assertEquals(401, send("POST", "/api/auth/login",
                json.writeValueAsString(Map.of("email", other, "password", "Wrong123!"))).statusCode());
        } finally { users.findByEmail(email).ifPresent(users::delete); }
    }

    @Test void signupLoginAndSessionProtection() throws Exception {
        long ownedQuest = create("쉬움");
        String email = UUID.randomUUID() + "@example.com";
        String credentials = json.writeValueAsString(Map.of("name", "Explorer", "email", email, "password", "Password1!"));
        try {
            String noSymbol = json.writeValueAsString(Map.of("name", "Explorer", "email", email, "password", "Password1"));
            assertEquals(400, send("POST", "/api/auth/signup", noSymbol).statusCode());
            String shortPassword = json.writeValueAsString(Map.of("name", "Explorer", "email", email, "password", "Ab1!"));
            var invalid = send("POST", "/api/auth/signup", shortPassword);
            assertEquals(400, invalid.statusCode());
            assertTrue(body(invalid).get("message").asText().contains("비밀번호"));
            assertEquals(201, send("POST", "/api/auth/signup", credentials).statusCode());
            assertEquals(409, send("POST", "/api/auth/signup", credentials).statusCode());
            User created = users.findByEmail(email).orElseThrow();
            assertNotEquals("Password1", created.getPasswordHash());
            assertEquals(200, send("POST", "/api/auth/logout", null).statusCode());
            assertEquals(401, send("GET", "/api/quests", null).statusCode());
            String bad = json.writeValueAsString(Map.of("email", email, "password", "Wrong123"));
            assertEquals(401, send("POST", "/api/auth/login", bad).statusCode());
            assertEquals(200, send("POST", "/api/auth/login", credentials).statusCode());
            assertEquals(created.getId().longValue(), body(send("GET", "/api/auth/me", null)).get("id").asLong());
            assertEquals(1, body(send("GET", "/api/auth/me", null)).get("level").asInt());
            assertEquals(0, body(send("GET", "/api/auth/me", null)).get("exp").asInt());
            assertEquals(0, body(send("GET", "/api/quests", null)).size());
            assertEquals(403, send("GET", "/api/users/" + userId, null).statusCode());
            assertEquals(404, send("DELETE", "/api/quests/" + ownedQuest, null).statusCode());
            assertTrue(quests.existsById(ownedQuest));
        } finally { users.findByEmail(email).ifPresent(users::delete); }
    }

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
        var manifest = send("GET", "/manifest.webmanifest", null);
        assertEquals(200, manifest.statusCode());
        assertTrue(manifest.headers().firstValue("Content-Type").orElse("").startsWith("application/manifest+json"));
        assertEquals("standalone", body(manifest).get("display").asText());
        assertEquals(200, send("GET", "/service-worker.js", null).statusCode());
        assertEquals(200, send("GET", "/icons/icon-192.png", null).statusCode());
        var health = send("GET", "/api/health", null);
        assertEquals(200, health.statusCode());
        assertEquals("UP", body(health).get("status").asText());
    }
    @Test void completionIsIdempotentAndDeletionKeepsEarnedExperience() throws Exception {
        long id = create("어려움");
        for (int i=0;i<2;i++) assertEquals(200, send("POST", "/api/quests/"+id+"/complete", null).statusCode());
        assertFalse(body(send("GET", "/api/quests", null)).get(0).get("completedAt").isNull());
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

    @Test void undoCompletionReversesRewardAndLevelOnlyOnce() throws Exception {
        long first = create("어려움"), second = create("어려움");
        assertEquals(200, send("POST", "/api/quests/"+first+"/complete", null).statusCode());
        assertEquals(200, send("POST", "/api/quests/"+second+"/complete", null).statusCode());
        assertEquals(2, user().get("level").asInt());
        var undone = send("DELETE", "/api/quests/"+first+"/complete", null);
        assertEquals(200, undone.statusCode());
        assertFalse(body(undone).get("completed").asBoolean());
        assertTrue(body(undone).get("completedAt").isNull());
        assertEquals(1, user().get("level").asInt());
        assertEquals(50, user().get("exp").asInt());
        assertEquals(50, user().get("totalExp").asInt());
        assertEquals(200, send("DELETE", "/api/quests/"+first+"/complete", null).statusCode());
        assertEquals(50, user().get("totalExp").asInt());
        assertEquals(200, send("POST", "/api/quests/"+first+"/complete", null).statusCode());
        assertEquals(2, user().get("level").asInt());
        assertEquals(100, user().get("totalExp").asInt());
    }
    @Test void higherLevelsRequireMoreExperience() throws Exception {
        for (int i=0; i<4; i++) {
            long id=create("어려움");
            assertEquals(200, send("POST", "/api/quests/"+id+"/complete", null).statusCode());
        }
        assertEquals(2,user().get("level").asInt());
        assertEquals(100,user().get("exp").asInt());
        assertEquals(110,user().get("nextLevelExp").asInt());
        assertEquals(200,user().get("totalExp").asInt());
        long next=create("보통");
        assertEquals(200, send("POST", "/api/quests/"+next+"/complete", null).statusCode());
        assertEquals(3,user().get("level").asInt());
        assertEquals(20,user().get("exp").asInt());
        assertEquals(120,user().get("nextLevelExp").asInt());
        assertEquals(230,user().get("totalExp").asInt());
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
        assertEquals(403,send("GET","/api/users/9223372036854775807",null).statusCode());
        assertEquals(404,send("POST","/api/quests/9223372036854775807/complete",null).statusCode());
        assertEquals(0,body(send("GET","/api/quests?userId="+userId,null)).size());
    }

    @Test void unusualTitlesAndInputBoundaries() throws Exception {
        String special = "눈사람 ☃️ & <script>alert('테스트')</script>";
        String valid = json.writeValueAsString(Map.of("userId", userId, "title", special,
            "category", "독서", "difficulty", "보통"));
        var saved = send("POST", "/api/quests", valid);
        assertEquals(201, saved.statusCode(), saved.body());
        assertEquals(special, body(saved).get("title").asText());
        assertEquals(1, body(send("GET", "/api/quests?userId=" + userId, null)).size());

        String hundred = "가".repeat(100);
        String atLimit = json.writeValueAsString(Map.of("userId", userId, "title", hundred,
            "category", "생활", "difficulty", "쉬움"));
        assertEquals(201, send("POST", "/api/quests", atLimit).statusCode());
        String overLimit = json.writeValueAsString(Map.of("userId", userId, "title", hundred + "가",
            "category", "생활", "difficulty", "쉬움"));
        assertEquals(400, send("POST", "/api/quests", overLimit).statusCode());
        assertEquals(400, send("POST", "/api/quests", "{}").statusCode());
        assertEquals(400, send("POST", "/api/quests", "{\"userId\":-1,\"title\":\"x\",\"category\":\"생활\",\"difficulty\":\"쉬움\"}").statusCode());
        assertEquals(2, body(send("GET", "/api/quests?userId=" + userId, null)).size());
    }

    @Test void repeatDeleteAndChangesToDeletedQuestAreRejected() throws Exception {
        long id = create("보통");
        assertEquals(204, send("DELETE", "/api/quests/" + id, null).statusCode());
        assertEquals(404, send("DELETE", "/api/quests/" + id, null).statusCode());
        assertEquals(404, send("POST", "/api/quests/" + id + "/complete", null).statusCode());
        assertEquals(404, send("PUT", "/api/quests/" + id, payload("보통")).statusCode());
        assertEquals(0, user().get("exp").asInt());
    }
}
