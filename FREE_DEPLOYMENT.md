# 무료 환경 배포 준비: Render + Aiven

현재 상태: **설정 준비 중이며, 무료 환경 배포와 데이터 이전은 아직 완료되지 않았습니다.** 기존 Railway 서비스를 중단하거나 삭제하지 않았습니다.

## 구성과 한계

- Render 무료 웹 서비스: 기존 Docker 이미지와 Java/Spring Boot를 사용합니다. 15분 동안 요청이 없으면 잠들며, 다음 요청 시 다시 시작하는 데 시간이 걸릴 수 있습니다. 무료 실행 시간·대역폭·빌드 시간에 한도가 있습니다. 결제 수단이 등록되어 있고 대역폭이나 빌드 한도를 넘으면 추가 요금이 발생할 수 있습니다.
- Aiven 무료 MySQL: 1GB 저장 공간과 백업을 제공합니다. 무료 플랜은 장기간 미사용 시 중지될 수 있으며, 이용 가능 지역과 서비스 정책은 변경될 수 있습니다.
- 기존 Railway MySQL과 Aiven은 별도 데이터베이스입니다. 기존 퀘스트, 완료 상태, 경험치, 레벨을 새 DB로 옮기고 검증하기 전에는 기존 서비스를 해제하지 않습니다.
- 로그인은 서버 인증이 없는 공용 데모입니다. 무료 호스팅으로 변경해도 방문자는 같은 퀘스트를 조회·수정·삭제할 수 있습니다.

## 연결 준비

1. Render 계정을 연결하고 저장소 `jigumeong012-byte/jigu`의 `free-render-aiven` 브랜치 접근을 허용합니다.
2. Aiven에서 **Free** MySQL 서비스를 생성합니다. 주소, 포트, DB 이름, 사용자명, 비밀번호와 프로젝트 CA 인증서를 확인합니다. 계정 비밀번호나 데이터베이스 자격 증명을 채팅 또는 Git에 넣지 않습니다.
3. `render.yaml`의 서비스가 `plan: free`인지 확인합니다. Render의 환경 변수에 다음 값을 별도로 설정합니다.
   - `DB_URL`: `jdbc:mysql://호스트:포트/DB이름?sslMode=VERIFY_IDENTITY&serverTimezone=Asia/Seoul&characterEncoding=UTF-8`
   - `DB_USERNAME`, `DB_PASSWORD`: Aiven 데이터베이스 사용자명과 비밀번호
   - `DB_SSL_CA_PEM`: Aiven 프로젝트 CA 인증서의 PEM 전체 내용. 컨테이너 시작 시 이 인증서로 JVM 신뢰 저장소를 만듭니다.
4. 기존 데이터를 안전하게 이전하고 사용자 레벨·경험치·퀘스트 항목과 완료 상태를 비교합니다. 가져오는 과정과 전환 시 쓰기 일관성은 실제 DB 연결 후 점검해야 합니다.
5. Render 배포 후 `/api/health`, 화면 표시, 퀘스트 생성·완료·재접속을 확인합니다. 모바일 홈 화면에 기존 Railway 주소를 설치했다면 새 주소로 다시 설치해야 합니다.
6. 새 서비스와 데이터가 확인된 이후 Railway의 요금제와 자원 정리 방법을 확인합니다. Railway 서비스를 중지하거나 삭제한다고 유료 구독이 자동 취소되는 것은 아닙니다. 구독 해지 및 기존 데이터 보존 여부는 별도로 확인해야 합니다.

## 공식 안내

- [Render 무료 서비스의 한도와 비용](https://render.com/docs/free)
- [Render Blueprint 설정](https://render.com/docs/blueprint-spec)
- [Aiven 무료 MySQL](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier)
- [Aiven TLS 인증서](https://aiven.io/docs/platform/concepts/tls-ssl-certificates)
