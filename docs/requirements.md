# What should the app do

- create users:
    - user name / password
    - put accounts
    - put income categories
    - put expense categories
- login
    - keep alive session
- add transaction (income/expense/transfer):
    - income:
        - date
        - description
        - account
        - income category
        - amount
    - expense:
        - date
        - description
        - account
        - expense category
        - amount
    - transfer:
        - date
        - description
        - account
        - destination
        - amount
- consult/modify transactions:
    - view all transactions (100 per page)
    - filter:
        - by date (default)
        - by category
        - by word
    - modify a transaction
    - delete a transaction
- easy dashboard:
    - total networth
    - amount in each account
    - last transaction
- view advanced analytics:
    - yet to define
- configure information:
    - accounts
    - income categories
    - expense categories

# Data base schema

- User:
    - id: text                      # pk
    - username: text                # unique
    - passwordHash: text
    - createdAt: text

- Account: 
    - id: text                      # pk
    - userId: text                  # fk User.id
    - name: text

- Category: 
    - id: text                      # pk
    - userId: text                  # fk User.id
    - name: text
    - type: "income" | "expense"

- Transaction:
    - id: text                      # pk
    - userId: text                  # fk User.id
    - date: text
    - description: text
    - type: "income" | "expense" | "transfer"
    - amount: float
    - accountId: text               # fk Account.id
    - destinationId: text           # fk (Account.id OR Category.id)

# UX

- login welcome page IF not cookie session
- home page: easy dashboard page with big "add transaction button". navigation footer with home|transactions|analytics|configuration
- transactions: excel like page with all information, with filters, with pagination
- analytics page to define
- configuration: let's you modify accounts, income categories, expense categories

# Architecture
- Nextjs Monolithic architecture (app / api)
- PWA, phone oriented (analytics page PC oriented)
- Hosting Cloudflare
- Cloudflare D1 DB
- Drizzle ORM
