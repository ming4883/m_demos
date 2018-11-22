#!/bin/bash

# Invoke emsdk_env.sh
echo "Setting up emsdk_env ..."

source ../emsdk/emsdk_env.sh > /dev/null

# Change to source dir and compile
cd ./cpp > /dev/null

EXPORTED_FUNCTIONS=""

OUT_DIR="../html/out"
if [ ! -d $OUT_DIR ]; then
  mkdir $OUT_DIR
fi

echo "Compiling ..."

emcc fft_ocean.cpp -o $OUT_DIR/fft_ocean_lib.html -std=c++11 -s EXPORTED_FUNCTIONS='["_fft_ocean_create", "_fft_ocean_destroy", "_fft_ocean_get_png", "_fft_ocean_evaluate"]' -s EXTRA_EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']"

# Report status
if [ $? -ne 0 ]; then
    echo "Error"
else
    echo "Done"
fi

# Clean up
cd - > /dev/null