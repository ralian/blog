FROM gcc:14-bookworm

RUN apt update && apt install -y cmake
WORKDIR /root
COPY ["*.cpp", "*.txt", "*.json", "./"]

#RUN cmake --build . --preset gcc-a
#RUN cmake --build . --preset gcc-b
#RUN cmake --build . --preset gcc-ab
