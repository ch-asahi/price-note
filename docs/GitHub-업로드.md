# GitHub에 price-note 올리기 (처음 하는 사람용)

아래는 처음 직접 공개 업로드할 때 따라 하는 순서입니다. 이미 저장소에 코드가 올라가 있다면 처음 올리기 과정은 생략합니다.

## 1. GitHub에 빈 저장소 만들기

1. [GitHub 새 저장소 만들기](https://github.com/new)를 열고 로그인합니다.
2. **Owner**에서 본인 계정을 선택합니다.
3. **Repository name**에 `price-note`를 입력합니다.
4. Description은 `직접 기록한 가격으로 진짜 세일을 확인하는 Chrome 확장 프로그램`으로 적습니다.
5. **Public**을 선택합니다. 코드와 업로드한 문서는 누구나 볼 수 있습니다.
6. README 추가는 끄고, `.gitignore`와 License는 선택하지 않습니다. README와 `.gitignore`는 이미 준비했습니다.
7. **Create repository**를 누르고 화면을 열어 둡니다.

공식 안내: [저장소 만들기](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)

## 2. 작업 폴더에서 PowerShell 열기

파일 탐색기에서 현재 프로젝트 폴더를 엽니다. 주소 표시줄에 `powershell`을 입력하고 Enter를 누릅니다. 또는 PowerShell에서 아래 명령을 실행합니다.

```powershell
Set-Location "$env:USERPROFILE\Documents\ChatGPT\가격추이"
git --version
```

버전이 보이면 다음으로 진행합니다. `git`을 찾지 못하면 [Git for Windows](https://git-scm.com/downloads/win)를 설치하고 PowerShell을 새로 엽니다.

## 3. 파일 목록 확인하고 첫 저장 만들기

현재 폴더에는 이미 Git 저장소가 준비되어 있어 `git init`은 필요 없습니다. 아래 명령은 한 줄씩 실행합니다.

```powershell
git status --short
git add .gitignore README.md docs price-tracker
git diff --cached --stat
git diff --cached --name-only
```

`git add`는 업로드할 파일을 고르는 명령입니다. 목록에 `.csv`, 개인 테스트 JSON, `.zip`, `docs/research/raw/` 파일이 없는지 확인하세요. `manifest.json`은 확장 프로그램 설치에 필수이므로 포함되는 것이 맞습니다.

제외 규칙은 아래 명령으로도 확인할 수 있습니다. 각 줄에 적용된 `.gitignore` 규칙이 보이면 정상입니다.

```powershell
git check-ignore -v 가격노트-백업.csv price-read-test-private.json
```

처음 Git을 쓰면 작성자 정보 설정이 필요할 수 있습니다. 아래 값은 본인 정보로 바꿉니다. 이메일은 GitHub **Settings → Emails**에 표시된 본인의 비공개용 `noreply` 주소를 쓸 수 있습니다. 이 설정은 현재 저장소에만 적용됩니다.

```powershell
git config user.name "내 GitHub 이름"
git config user.email "내 GitHub noreply 이메일"
git commit -m "Prepare price-note for public release"
```

`git commit`은 현재 파일 상태를 내 PC의 Git에 저장합니다. 아직 인터넷에 올라가지는 않습니다.

## 4. GitHub 주소 연결하고 업로드하기

아래 `YOUR-ID`를 본인 GitHub 아이디로 바꿉니다. 새 저장소 화면의 HTTPS 주소를 복사해도 됩니다.

```powershell
git branch -M main
git remote add origin https://github.com/YOUR-ID/price-note.git
git push -u origin main
```

로그인 창이나 브라우저 인증 화면이 뜨면 본인의 GitHub 계정으로 인증합니다. 인증 토큰을 README나 코드에 적지 마세요. `origin already exists`가 나오면 `git remote -v`로 연결 주소를 먼저 확인하고, 이번에 만든 저장소 주소가 맞는지 살펴보세요. 업로드가 거절되면 강제 push를 쓰지 말고 오류 내용을 확인하세요.

이 안내의 `main`은 처음 공개할 기본 브랜치입니다. 이후 기능을 수정할 때는 별도 작업 브랜치를 만들어 사용할 수 있습니다.

공식 안내: [파일을 저장소에 추가하기](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)

## 5. 올라갔는지 확인하기

1. GitHub의 `price-note` 페이지를 새로고침합니다.
2. 상단에 **Public**이 표시되고, README가 본문에 보이는지 확인합니다.
3. `price-tracker/manifest.json`과 `docs`가 있는지 확인합니다.
4. CSV·개인 JSON·이전 ZIP이 없는지 확인합니다.
5. **Code → Download ZIP**으로 내려받아 압축을 풀면 `price-tracker`를 Chrome에 설치할 수 있습니다.

GitHub 업로드는 소스 코드 공개입니다. 가격 기록은 Chrome에 있으므로 별도로 **CSV 내보내기**를 해야 백업됩니다.

## 다음에 코드를 수정하고 올릴 때

변경한 코드를 확인하고 테스트한 뒤 아래를 실행합니다.

```powershell
git status --short
git add .gitignore README.md docs price-tracker
git diff --cached --stat
git commit -m "Describe the changes"
git push
```

화면 캡처는 `docs/screenshots/`에 넣고 README의 이미지 주석을 풀면 함께 업로드할 수 있습니다. 웹 화면에서 파일을 직접 드래그해 올리는 경우에는 `.gitignore`가 파일 선택을 대신해 주지 않으므로, 이 안내처럼 Git으로 업로드하는 편이 편리합니다.
