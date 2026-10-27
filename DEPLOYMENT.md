# Railway 배포

이 저장소는 프론트엔드와 Spring Boot를 한 Docker 이미지로 빌드합니다. MySQL은 Railway의 별도 데이터베이스 서비스로 실행합니다.

## 구성

- Dockerfile: Java 21 / Maven 빌드, 비관리자 JRE 실행.
- railway.json: Docker 빌드, `/api/health` 상태 확인, 실패 시 최대 3회 재시작.
- prod 프로필: 0.0.0.0과 Railway의 PORT에서 수신. DB_URL / DB_USERNAME / DB_PASSWORD 필수.
- .github/workflows/ci.yml: JavaScript 검사·테스트와 별도 MySQL DB를 사용한 Java 통합 테스트·패키징.

## Railway 설정

1. Railway 프로젝트를 만들고 MySQL 서비스를 추가합니다. 데이터 볼륨을 유지합니다.
2. GitHub `jigumeong012-byte/jigu`의 main 브랜치를 앱 서비스로 연결합니다. 빌드 루트는 저장소 루트입니다.
3. 앱 서비스에 다음 변수를 설정합니다. 아래 참조의 `MySQL`은 실제 데이터베이스 서비스 이름과 일치해야 합니다.

```dotenv
DB_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}?allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
```

SPRING_PROFILES_ACTIVE=prod는 Docker 이미지에 지정되어 있으며 PORT는 Railway가 주입합니다. DB 연결은 Railway 사설 네트워크를 사용합니다. 환경 변수 값은 Railway에서 관리하고 Git에 저장하지 않습니다.

4. 배포 후 `/api/health`가 HTTP 200, `{"status":"UP"}`를 반환하는지 확인하고 웹 도메인을 생성합니다.
5. 화면에서 퀘스트를 생성하고 새로고침해 저장 여부를 확인합니다.

## 데이터와 접근 범위

현재 앱은 서버 사용자 ID 1을 함께 사용하는 공용 데모입니다. 화면의 로그인·회원가입은 브라우저 데모이며 서버 인증을 제공하지 않습니다. 공개 주소의 방문자는 같은 서버 퀘스트를 조회·수정·삭제할 수 있으므로 공용 데모 데이터로 사용하세요. 개인용 서비스에는 서버 인증과 사용자별 권한 분리가 추가로 필요합니다.

로컬 MySQL 데이터나 `.local/connection.json`은 저장소와 배포 이미지에 포함되지 않습니다. 새 클라우드 DB에서 사용자와 스키마가 초기화됩니다. MySQL 데이터가 남아 있는 한 재배포 후에도 퀘스트와 경험치가 유지됩니다. 메모·체크리스트·프로필은 각 브라우저에 저장됩니다.

## 연결이 필요한 항목

실제 배포에는 Railway 계정 연결과 해당 계정의 이용 가능한 실행 자원이 필요합니다. 요금제 변경·결제는 사용자가 관리합니다. GitHub 커밋 또는 설정 파일 생성만으로 배포가 완료된 것은 아니며, 배포 상태와 실제 접속 URL을 확인해야 합니다.

공식 문서: https://docs.railway.com/guides/dockerfiles / https://docs.railway.com/databases/mysql / https://docs.railway.com/deployments/healthchecks
