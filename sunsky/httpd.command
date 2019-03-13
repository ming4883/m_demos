#!/bin/sh

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "${DIR}"

echo "Running Python SimpleHTTPServer ..."

python -m SimpleHTTPServer

