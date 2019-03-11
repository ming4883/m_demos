#!/bin/sh

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "${DIR}"

./nwjs-sdk-v0.36.4-osx-x64/nwjs.app/Contents/MacOS/nwjs ${DIR}/ > /dev/null 2>/dev/null &
#./nwjs-sdk-v0.36.4-osx-x64/nwjs.app/Contents/MacOS/nwjs ${DIR}/
