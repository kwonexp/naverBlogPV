# Release Guide (Internal)

## Versioning Rule
- Use semantic version in `extension/manifest.json`.
- Increase:
- Patch: bug fix only.
- Minor: backward-compatible feature.
- Major: breaking behavior/UI changes.

## Internal Packaging
1. Update `manifest.json` version.
2. Validate syntax:
- `node --check extension/content.js`
- `node --check extension/popup.js`
3. Create zip:
- `cd <project-root>`
- `zip -r naver-rank-exporter.zip extension -x "*/.DS_Store"`

## Install on Another Machine
1. Transfer `naver-rank-exporter.zip`.
2. Unzip to a local folder.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click `Load unpacked`.
6. Select unzipped `extension` folder.

## Updating Existing Install
1. Replace files in local extension folder.
2. Open `chrome://extensions`.
3. Click reload on this extension.
4. Refresh target Naver page tab.
