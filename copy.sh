#!/bin/bash

set -ue
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

_options="-v --progress --progress-terminal-title --s3-acl=public-read"
_options="${_options} --filter '+ s3.js' --filter '+ index.html' --filter '+ dark-mode.css' --filter '- **'"

remote=
if rclone lsd "${1:-}" &> /dev/null; then
  remote="${1}"
  shift
else
  echo "'${1:-}' is not a valid remote"
  exit 1
fi

command="rclone copy ${_options} \"${script_dir}\" \"${remote}\""

echo "$command $@"
eval $command '"$@"'

exit 0
