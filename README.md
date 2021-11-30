# Ethereum smart contract analysis tool 

This tool helps analyse and visualise recently created smart contracts on the Ethereum blockchain.

## Documentation

[Timekeeping](documentation/timekeeping.md)

[Specification](documentation/specification.md)

[Architecture](documentation/architecture.md)

## Usage

1. Install dependencies

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

## Testing

Run test battery
```bash
poetry run invoke test
```

Generate coverage report
```bash
poetry run invoke coverage-report
```

Check code accuracy
```bash
poetry run invoke lint
```