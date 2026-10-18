# quick-edit-nbl-publish

Repo phát hành [quick-edit-nbl](https://www.npmjs.com/package/quick-edit-nbl) lên npm **mà không đưa source (repo private) ra ngoài**. Repo này không chứa đường dẫn hay thông tin nào của source repo; đường dẫn chỉ nằm ở `release.local.json` trên máy build (gitignored).

- Nhánh `main`: chỉ có tooling build/release (repo này).
- Nhánh `release`: orphan, chỉ chứa package đã build (`dist/`) + workflow publish. Mỗi lần release là một commit + tag `v<version>`.

## Luồng

```
source repo (private) ──git archive <ref>──► .work/src ──pnpm install + next build (standalone)──►
  dist/  (server.js + .next đã minify + static + public + messages, KHÔNG có src/.env/.map)
    └─ push-release.sh ──► nhánh release + tag vX.Y.Z ──► GitHub Actions ──► npm publish
```

`build-release.mjs`:

1. `git archive` đúng commit của `sourceRef` (chỉ file đã commit → không lấy `.env.local`, không lấy code chưa commit).
2. Ép `output: "standalone"` trong bản copy `next.config.ts` (không sửa source repo).
3. Chỉ copy whitelist: `server.js`, `.next` (bỏ `cache`, `*.map`, `*.nft.json`), `.next/static`, `public`, `runtimeAssets`.
4. Server externals của Turbopack (`.next/node_modules/pg-<hash>` …) được thay bằng shim re-export; package thật (`pg`, `@napi-rs/keyring`, `execa`, `chokidar`, `next`, `react`…) khai báo trong `dependencies`, pin đúng version trong lockfile → npm cài đúng binary theo OS người dùng.
5. Leak scan: fail nếu `dist/` có đường dẫn máy build/source, `.env*`, `*.map`, `*.ts`, `src/`, `*.nft.json`, `CLAUDE.md`, `node_modules` lạ.

## Cấu hình

- `release.config.json` (commit): ref build, tên package npm, tên lệnh bin, port mặc định, thư mục runtime cần ship (`messages` — đọc lúc chạy).
- `release.local.json` (gitignored, mẫu ở `release.local.example.json`): đường dẫn source repo trên máy build. Tạo bằng `make init SOURCE=/path/to/source-repo`, hoặc đặt env `SOURCE_REPO`.

## Dùng

Yêu cầu Node 24 (Makefile tự `nvm use` theo `.nvmrc`), corepack (pnpm theo `packageManager` của source). Gõ `make` để xem mọi lệnh.

```bash
make init SOURCE=/path/to/source-repo   # một lần trên mỗi máy build
make doctor                  # kiểm tra Node/pnpm, ref nguồn, npm login
make build                   # build từ source main → dist/
make build REF=v0.2.0        # build từ tag/commit khác
make build VERSION=0.2.0     # ghi đè version (mặc định lấy version trong package.json của source)
make pack-check              # xem danh sách file sẽ lên npm
make try PORT=3099           # cài từ tarball vào .work/try và chạy thử (data riêng, không đụng ~/.spec-studio)
make release-dry             # build + commit vào nhánh release + tag, chưa push (gỡ bằng make undo-dry)
make release                 # build + commit + push nhánh release + tag → CI publish
```

Trước mỗi release: bump `version` trong `package.json` của source (hoặc `VERSION=`). Script dừng nếu tag đã tồn tại; CI bỏ qua nếu version đã có trên npm. Không có `make` thì dùng `npm run build|release|release:dry|pack:check`.

## Thiết lập một lần trên GitHub / npm

1. Tạo token npm (Granular, quyền publish) → repo Settings → Secrets → Actions → `NPM_TOKEN`.
2. `--provenance` cần repo **public**. Nếu để private, bỏ `--provenance` trong `release-branch/.github/workflows/publish.yml`.
3. (Tuỳ chọn) Sau lần publish đầu, bật Trusted Publishing trên npmjs.com cho repo này + workflow `publish.yml`, rồi xoá `NPM_TOKEN`.

Publish tay không qua CI: `npm login` rồi `make publish-local`.

## Lưu ý

- Bản build là JS đã minify, không có source map — khó đọc nhưng không phải mã hoá; đừng để secret trong source code.
- Đường dẫn tuyệt đối máy build mà Next nhúng vào `server.js` / `required-server-files.json` được thay bằng `/app`; leak scan fail nếu còn sót đường dẫn máy build hoặc source repo trong `dist/`.
- Migration Postgres (`db:migrate`) chạy bằng `tsx` trên source nên **không** có trong package; package mặc định dùng `DATA_DRIVER=JSON`.
- Nếu source thêm thư mục được đọc lúc chạy qua `process.cwd()` (như `messages/`), thêm vào `runtimeAssets`.
- Nếu dòng `export default …` trong `next.config.ts` của source đổi, build fail và báo cần cập nhật marker trong `patchNextConfig()`.
