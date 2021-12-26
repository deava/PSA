from database_connection import get_database_connection


def drop_tables(connection):
    cursor = connection.cursor()

    cursor.execute('''
        drop table if exists transactions;
    ''')

    cursor.execute('''
        drop table if exists contracts;
    ''')
    connection.commit()


def create_tables(connection):
    cursor = connection.cursor()

    cursor.execute(
        '''create table transactions (date text,
        hash text unique,
        from_address text,
        to_address text,
        amount text,
        gas text
        );''')

    cursor.execute(
        '''create table contracts (date text,
        hash text unique,
        creator_address text,
        contract_address text,
        name text
        );''')

    connection.commit()


def initialize_database():
    """
    Initializes the database by getting a connection
    """

    connection = get_database_connection()

    drop_tables(connection)
    create_tables(connection)


if __name__ == "__main__":
    initialize_database()
