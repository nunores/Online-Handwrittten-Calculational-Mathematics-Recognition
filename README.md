# Tablet-PC-Tool-for-Handwriting-Recognition

## Installation

### Ubuntu

These instuctions assume the usage of the Ubuntu distribution and that __npm is installed__. 

#### 1. Clone the repository:

```bash
git clone https://github.com/nunores/Tablet-PC-Tool-for-Handwriting-Recognition
cd Tablet-PC-Tool-for-Handwriting-Recognition
```

#### 2. Execute script

Give [install.sh](./install.sh) permission for executions with the command:

```bash
chmod +x install.sh 
```

Then, run [install.sh](./install.sh) with the command:

```bash
sh install.sh 
```

#### 3. Whiteboard terminal

```bash
cd whiteboard
sudo npm ci
npm run start:prod
```

#### 4. Express-Server terminal

```bash
cd Express-Server
sudo npm install
npm run prod
```

##### 5. Open localhost:8080

To restart the environment, terminate both processes with Ctrl-C and rerun the previous commands.
