# quick-edit-nbl-publish — build source repo (private) thành package npm (không kèm source) rồi release.
# Gõ `make` hoặc `make help` để xem danh sách.
#
# Biến tuỳ chọn:
#   SOURCE=<path>      đường dẫn source repo, cho `make init` (lưu vào release.local.json, không commit)
#   REF=<git-ref>      ref của source cần build (mặc định sourceRef trong release.config.json)
#   VERSION=<semver>   ghi đè version (mặc định version trong package.json của source)
#   PORT=<n>           port cho `make try` (mặc định 3099)

SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help
MAKEFLAGS += --no-print-directory

# Nạp nvm + Node theo .nvmrc trước mỗi lệnh, để make chạy đúng Node 24 kể cả khi shell đang ở bản khác.
NVM_DIR ?= $(HOME)/.nvm
NODE := source "$(NVM_DIR)/nvm.sh" --no-use && nvm use --silent >/dev/null &&

BUILD_ARGS := $(if $(REF),--ref $(REF)) $(if $(VERSION),--version $(VERSION))
PORT ?= 3099
TRY_DIR := .work/try

# In ra một field của config đã gộp (release.config.json + release.local.json + SOURCE_REPO).
CONFIG = node --input-type=module -e 'import("./scripts/config.mjs").then((m) => console.log(m.loadConfig()[process.argv[1]]))'

##@ Cài đặt

.PHONY: init
init: ## Lưu đường dẫn source repo trên máy này: make init SOURCE=/path/to/source-repo
	@test -n "$(SOURCE)" || { echo "Thiếu SOURCE: make init SOURCE=/path/to/source-repo"; exit 1; }
	@test -d "$(SOURCE)/.git" || { echo "Không phải git repo: $(SOURCE)"; exit 1; }
	@printf '{\n  "sourceRepo": "%s"\n}\n' "$$(cd "$(SOURCE)" && pwd)" > release.local.json
	@echo "Đã ghi release.local.json (gitignored)"

.PHONY: doctor
doctor: ## Kiểm tra Node/corepack/pnpm, source repo và đăng nhập npm
	@$(NODE) printf 'node      %s (yêu cầu %s)\n' "$$(node -v)" "$$(cat .nvmrc)"
	@$(NODE) src="$$($(CONFIG) sourceRepo)"; ref="$$($(CONFIG) sourceRef)"; \
		printf 'pnpm      %s\n' "$$(cd "$$src" && corepack pnpm --version 2>/dev/null || echo 'lỗi: corepack/pnpm')"; \
		printf 'source    %s @ %s (%s)\n' "$$src" "$$ref" "$$(git -C "$$src" rev-parse --short "$$ref" 2>/dev/null || echo 'không tìm thấy')"
	@$(NODE) printf 'npm user  %s\n' "$$(npm whoami 2>/dev/null || echo '(chưa npm login — chỉ cần cho make publish-local)')"

##@ Build

.PHONY: build
build: ## Build source từ commit sạch → dist/ (REF=..., VERSION=...)
	@$(NODE) node scripts/build-release.mjs $(BUILD_ARGS)

.PHONY: reassemble
reassemble: ## Đóng gói lại dist/ từ bản build cũ trong .work (không build lại)
	@$(NODE) node scripts/build-release.mjs --reuse true $(BUILD_ARGS)

.PHONY: pack-check
pack-check: ## Liệt kê file sẽ lên npm (npm pack --dry-run)
	@test -f dist/package.json || { echo "Chưa có dist/: chạy make build"; exit 1; }
	@$(NODE) cd dist && npm pack --dry-run

.PHONY: try
try: ## Cài dist/ từ tarball vào thư mục tạm rồi chạy thử (PORT=3099, data riêng)
	@test -f dist/package.json || { echo "Chưa có dist/: chạy make build"; exit 1; }
	@rm -rf $(TRY_DIR) && mkdir -p $(TRY_DIR)
	@$(NODE) bin="$$($(CONFIG) binName)" && \
		tgz="$$(cd dist && npm pack --pack-destination ../$(TRY_DIR) --silent)" && \
		cd $(TRY_DIR) && npm init -y >/dev/null && npm install --silent "./$$tgz" && \
		SPEC_STUDIO_HOME="$$PWD/home" "node_modules/.bin/$$bin" --port $(PORT)

##@ Release

.PHONY: release-dry
release-dry: build ## Build + commit vào nhánh release + tag, KHÔNG push
	@$(NODE) scripts/push-release.sh --no-push

.PHONY: release
release: build ## Build + commit nhánh release + tag + push → CI publish npm
	@$(NODE) scripts/push-release.sh

.PHONY: publish-local
publish-local: ## Publish dist/ thẳng lên npm từ máy này (cần npm login)
	@test -f dist/package.json || { echo "Chưa có dist/: chạy make build"; exit 1; }
	@$(NODE) cd dist && npm publish --access public

.PHONY: undo-dry
undo-dry: ## Xoá nhánh release + tag local do release-dry tạo (chưa push)
	@$(NODE) tag="v$$(node -p 'require("./dist/package.json").version')"; \
		git worktree remove --force .work/release-branch 2>/dev/null || true; \
		git tag -d "$$tag" 2>/dev/null || true; \
		if ! git rev-parse -q --verify refs/remotes/origin/release >/dev/null; then git branch -D release 2>/dev/null || true; fi; \
		echo "Đã xoá $$tag và worktree release (local)"

##@ Dọn dẹp

.PHONY: clean
clean: ## Xoá dist/ và thư mục chạy thử
	@rm -rf dist $(TRY_DIR) *.tgz

.PHONY: clean-all
clean-all: ## Xoá thêm .work (source export + node_modules của bản build)
	@git worktree remove --force .work/release-branch 2>/dev/null || true
	@rm -rf dist .work *.tgz

##@ Trợ giúp

.PHONY: help
help: ## Hiện danh sách lệnh
	@awk 'BEGIN {FS = ":.*## "; printf "\nCách dùng: make \033[36m<target>\033[0m\n"} \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } \
		/^[a-zA-Z0-9_-]+:.*## / { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo
