# Tablet-PC-Tool-for-Handwriting-Recognition

## Installation

### 1. Clone the repository:

```bash
https://github.com/nunores/Tablet-PC-Tool-for-Handwriting-Recognition
```

### 2. Extract boost libraries

The boost libraries (https://boostorg.jfrog.io/artifactory/main/release/1.82.0/source/) should be placed inside seshat. The project should have the following structure:

├── Express-Server
├── seshat
│   ├── boost_1_82_0
├── whiteboard
├── README.md

### 3. Compile seshat

```bash
cd seshat
make
```

### 3. Terminal nº1

```bash
cd whiteboard
npm run start:prod
```

### 4. Terminal nº2

```bash
cd Express-Server
npm run prod
```

#### 5. Open localhost:8080
