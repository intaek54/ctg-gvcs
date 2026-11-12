# CTG — 17기 학생회 사이트 설정 안내

- **데이터베이스와 관리자 로그인:** Supabase를 써요.
- **배포:** Vercel을 써요. 주소는 https://ctg-gvcs.vercel.app 이에요.
- **코드:** GitHub에 올려 둬요.

---

## 1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com)에 로그인하고 **New project**를 누르세요.
   - 이름은 `ctg`처럼 아무거나 쓰셔도 돼요.
   - Region은 **Northeast Asia (Seoul)**을 고르세요.
   - 데이터베이스 비밀번호는 따로 적어 두세요. 이 사이트에서는 쓰지 않아요.
2. 프로젝트가 만들어지면 **Project Settings → API**(또는 **Data API**)로 가서 아래 두 값을 복사하세요.
   - **Project URL**: `https://xxxx.supabase.co` 형태예요.
   - **anon public** 키(또는 **publishable** 키)
3. 복사한 두 값을 `supabase-config.js`의 `PASTE_…` 자리에 붙여 넣으세요.

> ⚠️ **service_role**(또는 **secret**) 키는 절대 넣지 마세요. 그 키를 가진 사람은 기도 제목을 포함한 모든 데이터를 볼 수 있어요.
> 반대로 anon 키는 공개돼도 괜찮아요. 데이터를 지키는 건 아래 2단계의 보안 규칙(RLS)이에요.

## 2. 테이블과 보안 규칙 만들기

1. Supabase 대시보드에서 **SQL Editor → New query**를 누르세요.
2. `supabase/schema.sql` 파일 내용을 전부 붙여 넣고 **Run**을 누르세요.
   - 이 SQL이 만드는 테이블은 이래요.
     - `submissions`: 질문과 기도 제목이 들어가요. 관리자만 볼 수 있어요.
     - `board`: 답변 게시판이에요. 누구나 볼 수 있어요.
     - `admins`: 관리자 목록이에요.
   - 여러 번 실행해도 문제없어요.

## 3. 관리자 계정 만들기

1. **Authentication → Users → Add user → Create new user**로 가세요.
   - 이메일과 비밀번호를 넣고, **Auto Confirm User**를 체크하세요.
2. **SQL Editor**에서 아래 SQL을 실행하세요. 이메일 부분은 방금 만든 계정의 이메일로 바꾸세요.
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = '관리자@이메일.com';
   ```
   관리자가 여러 명이면 사람마다 1~2번을 반복하세요.

## 4. 아무나 가입하지 못하게 막기

**Authentication → Sign In / Providers**로 가서 **Allow new users to sign up**을 끄세요.

이걸 꺼도 이미 만든 관리자 계정은 그대로 로그인할 수 있어요.

## 5. 로그인 주소 등록

**Authentication → URL Configuration**으로 가서 **Site URL**에 `https://ctg-gvcs.vercel.app`을 넣으세요.

---

## 확인하기

1. https://ctg-gvcs.vercel.app 에서 질문과 기도 제목을 하나씩 보내 보세요. 초록색 확인 메시지가 떠야 해요.
2. 왼쪽 위 로고를 눌러 `admin.html`로 가서 관리자 계정으로 로그인하세요.
3. **Connection check**에 체크 표시가 3개 떠야 해요.
4. 질문에 답하고 게시판에 올린 다음, 홈 화면에 그 답변이 보이는지 확인하세요.

## 문제가 생기면

| 화면에 보이는 것 | 뜻 |
|---|---|
| `config-missing` | `supabase-config.js`에 키가 아직 안 들어갔어요 (1단계) |
| `PGRST205` / `42P01` | 테이블이 아직 없어요. `schema.sql`을 실행하세요 (2단계) |
| `42501` | 보안 규칙이 막고 있어요. `schema.sql`을 다시 실행하세요 |
| `not-admin` | 로그인은 됐지만 `admins` 목록에 없는 계정이에요 (3단계) |
| `invalid_credentials` | 이메일이나 비밀번호가 틀렸어요 |
| `email_not_confirmed` | 계정 이메일 인증이 안 됐어요. **Auto Confirm User**로 다시 만드세요 |
| Couldn't reach Supabase | 인터넷 연결을 확인하세요. 무료 프로젝트는 일주일 동안 접속이 없으면 일시 정지되니, 대시보드에서 **Restore**를 누르세요 |

자세한 오류 내용은 브라우저에서 우클릭 → **검사** → **Console**을 열면 `[CTG]`로 시작하는 메시지로 볼 수 있어요.

## 번역 기능 참고

관리자가 답변을 올릴 때 쓰는 자동 번역은 무료 API인 MyMemory를 사용해요.
- 하루에 IP당 약 5,000자까지 번역할 수 있어요.
- 번역 결과는 초안이에요. 올리기 전에 직접 다듬을 수 있어요.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 홈 화면 (최근 7일 동안 올라온 답변) |
| `answers.html` | 전체 답변 (검색 가능) |
| `ask-the-pastor.html` | 질문 보내기 |
| `send-your-prayer.html` | 기도 제목 보내기 (비공개) |
| `admin.html` | 관리자 페이지 |
| `app.js` | 데이터베이스 연결과 오류 메시지 |
| `supabase-config.js` | Supabase 주소와 공개 키 |
| `supabase/schema.sql` | 테이블과 보안 규칙 (Supabase SQL Editor에서 실행) |
| `i18n.js` | 영어/한국어 전환 |
| `styles.css` | 디자인 |
