# Tablet-PC-Tool-for-Handwriting-Recognition

## Installation

#### 1. Clone the repository:

```bash
git clone https://github.com/nunores/Tablet-PC-Tool-for-Handwriting-Recognition
cd Tablet-PC-Tool-for-Handwriting-Recognition
```

#### 2. Build the docker image

```bash
docker build -t tabletpctool .
```

#### 3. Run docker

```bash
docker run -p 8080:8080 -p 4000:4000 --name tabletpctool tabletpctool
```
##### 4. Terminating or restarting

If you need to terminate or restart the environment, run 

```bash
docker stop tabletpctool
docker start tabletpctool
```
