#!/bin/bash
# Acceptance-only environment guard, followed by the unchanged production host.
set -eu
bridge_host="$1"
bridge_dir="$2"
case "$bridge_dir" in /tmp/ab-interconnect-win-wsl-20261103) ;; *) exit 78 ;; esac
native_home=$(getent passwd "$(id -u)" | cut -d: -f6)
case "$native_home" in /*) ;; *) exit 78 ;; esac
case "$(readlink -f "$native_home")" in /mnt/c|/mnt/c/*) exit 78 ;; esac
export HOME="$native_home"
export CODEX_HOME="$native_home/.codex"
unset CODEX_SQLITE_HOME CODEX_CLI_PATH
filtered_path=''
IFS=: read -r -a native_paths <<< "${PATH-}"
for native_path in "${native_paths[@]}"; do
  case "$native_path" in /mnt/c|/mnt/c/*|'') continue ;; esac
  filtered_path="${filtered_path:+$filtered_path:}$native_path"
done
export PATH="${filtered_path:-/usr/local/bin:/usr/bin:/bin}"
umask 077
mkdir -p "$bridge_dir"
[ ! -L "$bridge_dir" ] && [ "$(readlink -f "$bridge_dir")" = "$bridge_dir" ]
[ "$(stat -c %u "$bridge_dir")" = "$(id -u)" ]
chmod 700 "$bridge_dir"
mkdir -p "$bridge_dir/tmp" "$bridge_dir/native-cache"
export TEMP="$bridge_dir/tmp" TMP="$bridge_dir/tmp" TMPDIR="$bridge_dir/tmp"
export XDG_CACHE_HOME="$bridge_dir/native-cache"
bridge_proxy_file="$bridge_dir/native-network-proxy"
if [ -e "$bridge_proxy_file" ]; then
  [ ! -L "$bridge_proxy_file" ]
  [ "$(stat -c %u "$bridge_proxy_file")" = "$(id -u)" ]
  [ "$(stat -c %a "$bridge_proxy_file")" = 600 ]
  IFS= read -r bridge_native_proxy < "$bridge_proxy_file"
  case "$bridge_native_proxy" in http://bridge:*@127.0.0.1:[0-9]*) ;; *) exit 78 ;; esac
  export HTTPS_PROXY="$bridge_native_proxy" HTTP_PROXY="$bridge_native_proxy"
  export https_proxy="$bridge_native_proxy" http_proxy="$bridge_native_proxy"
  export NO_PROXY='127.0.0.1,localhost,::1' no_proxy='127.0.0.1,localhost,::1'
fi
exec /bin/bash "${bridge_host%/dist/*}/desktop/electron/bootstrap.sh" "$bridge_host" "$bridge_dir"
