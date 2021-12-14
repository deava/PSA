# Users guide

# Configuration
You can configure the app to use your own Etherscan API key by editing the .env file.

# Starting the app
Before you can run the app you should run the following commands in the console:

1. Install necessary dependencies
```bash
poetry install
```

2. Initialize the database

```bash
poetry run invoke build
```

3. Start the app with:

```bash
poetry run invoke start
```

If you face an error with importing etherscan run the following command:

```bash
pip install etherscan-python
```

# Running the app

After running poetry invoke start you are prompted with a text ui in the console. This is a placeholder until the graphical ui is finished. The commands currently on offer are. Stop running, Get all contracts in database, get all transactions in the database, add new contract to the database, add a new transaction to the database. Below is an illustrative photo of the functioning of the app:

![Photo](./photos/usage.png)