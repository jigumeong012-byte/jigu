package com.lifequest.api;

import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> status(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode())
            .body(Map.of("message", exception.getReason() == null ? "요청을 처리할 수 없습니다." : exception.getReason()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
        MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception exception) {
        return ResponseEntity.badRequest().body(Map.of("message", "제목, 카테고리, 사용자 ID와 난이도(쉬움/보통/어려움)를 확인해주세요."));
    }

    @ExceptionHandler({DataIntegrityViolationException.class, PessimisticLockingFailureException.class})
    public ResponseEntity<Map<String, String>> conflict(Exception exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "데이터가 변경되었습니다. 새로고침 후 다시 시도해주세요."));
    }
}
