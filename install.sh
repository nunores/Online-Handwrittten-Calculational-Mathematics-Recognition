#!/bin/bash

sudo apt-get update
sudo apt-get install -y libxerces-c-dev
sudo apt-get install -y p7zip-full

wget https://boostorg.jfrog.io/artifactory/main/release/1.82.0/source/boost_1_82_0.7z

7z x boost_1_82_0.7z -o./seshat

rm boost_1_82_0.7z

cd seshat

mkdir temp
mkdir out

make

