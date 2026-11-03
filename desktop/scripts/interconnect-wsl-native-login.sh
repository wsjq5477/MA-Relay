#!/bin/bash
# Interactive native account sign-in. Never redirect the one-time code to a log.
set -eu
bridge_dir=/tmp/ab-interconnect-win-wsl-20261103
native_home=$(getent passwd "$(id -u)" | cut -d: -f6)
case "$(readlink -f "$native_home")" in /mnt/c|/mnt/c/*|'') exit 78 ;; esac
[ "$(readlink -f "$bridge_dir")" = "$bridge_dir" ] && [ ! -L "$bridge_dir" ]
[ "$(stat -c %u "$bridge_dir")" = "$(id -u)" ]
proxy_file="$bridge_dir/native-network-proxy"
[ ! -L "$proxy_file" ] && [ "$(stat -c %a "$proxy_file")" = 600 ]
[ "$(stat -c %u "$proxy_file")" = "$(id -u)" ]
IFS= read -r native_proxy < "$proxy_file"
case "$native_proxy" in http://bridge:*@127.0.0.1:[0-9]*) ;; *) exit 78 ;; esac
export HOME="$native_home" CODEX_HOME="$native_home/.codex"
export HTTPS_PROXY="$native_proxy" HTTP_PROXY="$native_proxy" https_proxy="$native_proxy" http_proxy="$native_proxy"
export NO_PROXY='127.0.0.1,localhost,::1' no_proxy='127.0.0.1,localhost,::1'
unset CODEX_SQLITE_HOME CODEX_CLI_PATH
umask 077
mkdir -p "$bridge_dir/tmp" "$bridge_dir/native-cache"
export TEMP="$bridge_dir/tmp" TMP="$bridge_dir/tmp" TMPDIR="$bridge_dir/tmp" XDG_CACHE_HOME="$bridge_dir/native-cache"
codex_cli="$native_home/.nvm/versions/node/v24.13.0/bin/codex"
export PATH="${codex_cli%/*}:/usr/local/bin:/usr/bin:/bin"
[ -x "$codex_cli" ]
case "$(readlink -f "$codex_cli")" in /mnt/c|/mnt/c/*|'') exit 78 ;; esac
if [ "${1-}" = --validate-only ]; then
  printf '%s\n' '{"ready":true,"nativeLinuxAccount":true,"originalProfile":true,"privateProxyPrepared":true,"newStateNonC":true,"loginStarted":false}'
  exit 0
fi
cd "$native_home"
printf '\033]0;AgentBridge WSL Codex native sign-in\007'
login_mode=device
login_args=(--device-auth)
if [ "${1-}" = --browser-login ]; then login_mode=browser; login_args=(); fi
printf '{"started":true,"finished":false,"mode":"%s"}\n' "$login_mode" > "$bridge_dir/native-login-result.json"
printf '%s\n' 'AgentBridge: native WSL Codex sign-in. Sign-in details are shown only in this window.'
set +e
"$codex_cli" login "${login_args[@]}"
login_code=$?
set -e
printf '{"finished":true,"exitCode":%s,"mode":"%s"}\n' "$login_code" "$login_mode" > "$bridge_dir/native-login-result.json"
printf '\nNative sign-in exited with code %s. Press Enter to close this window.\n' "$login_code"
IFS= read -r ignored || true
exit "$login_code"
