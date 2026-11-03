#!/bin/bash
# Scoped launcher: only Codex inherits the private acceptance network route.
set -eu
native_home=$(getent passwd "$(id -u)" | cut -d: -f6)
bridge_dir=/tmp/ab-interconnect-win-wsl-20261103
codex_cli="$native_home/.nvm/versions/node/v24.13.0/bin/codex"
node_cli="${codex_cli%/*}/node"
for native_path in "$native_home" "$codex_cli"; do
  case "$(readlink -f "$native_path")" in /mnt/c|/mnt/c/*|'') exit 78 ;; esac
done
[ -d "$bridge_dir" ] && [ ! -L "$bridge_dir" ] && [ "$(readlink -f "$bridge_dir")" = "$bridge_dir" ]
[ "$(stat -c %u "$bridge_dir")" = "$(id -u)" ]
case "$(pwd -P)" in /mnt/c|/mnt/c/*) printf '%s\n' 'Codex workspace must be outside C:.' >&2; exit 78 ;; esac
unset CODEX_SQLITE_HOME CODEX_CLI_PATH
export HOME="$native_home" CODEX_HOME="$native_home/.codex"
export PATH="${codex_cli%/*}:/usr/local/bin:/usr/bin:/bin"
umask 077
mkdir -p "$bridge_dir/tmp" "$bridge_dir/native-cache"
export TEMP="$bridge_dir/tmp" TMP="$bridge_dir/tmp" TMPDIR="$bridge_dir/tmp" XDG_CACHE_HOME="$bridge_dir/native-cache"
case "${1-}" in --help|-h|--version|-V) exec "$codex_cli" "$@" ;; esac
if [ "${1-}" = login ] && [ "${2-}" = status ]; then exec "$codex_cli" "$@"; fi
proxy_file="$bridge_dir/native-network-proxy"
if [ ! -f "$proxy_file" ] || [ -L "$proxy_file" ] || [ "$(stat -c %a "$proxy_file")" != 600 ] || [ "$(stat -c %u "$proxy_file")" != "$(id -u)" ]; then
  printf '%s\n' 'Codex network route is not prepared; no request was sent.' >&2
  exit 78
fi
IFS= read -r native_proxy < "$proxy_file"
case "$native_proxy" in http://bridge:*@127.0.0.1:[0-9]*) ;; *) exit 78 ;; esac
export HTTPS_PROXY="$native_proxy" HTTP_PROXY="$native_proxy" https_proxy="$native_proxy" http_proxy="$native_proxy"
export NO_PROXY='127.0.0.1,localhost,::1' no_proxy='127.0.0.1,localhost,::1'
"$node_cli" -e '
const net=require("net");let p;
try{p=new URL(process.env.HTTPS_PROXY);if(p.protocol!=="http:"||p.hostname!=="127.0.0.1"||p.username!=="bridge"||!/^[a-f0-9]{48}$/.test(p.password)||!p.port)throw Error();}
catch{process.stderr.write("Invalid private Codex network route.\n");process.exit(78);}
const socket=net.connect({host:p.hostname,port:Number(p.port)});
const timer=setTimeout(()=>{socket.destroy();process.exitCode=78;},2500);
socket.once("connect",()=>{clearTimeout(timer);socket.destroy();});
socket.once("error",()=>{clearTimeout(timer);process.exitCode=78;});
' || { printf '%s\n' 'Codex network route is offline; no native request was sent.' >&2; exit 78; }
exec "$codex_cli" "$@"
