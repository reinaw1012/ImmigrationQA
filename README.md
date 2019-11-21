# Immigration QnA

This is a messenger chat bot that gives information about different types of US visas, as well as employment opportunities avaliable for holders of different visas.

It uses [LUIS](https://www.luis.ai) to implement core AI capabilities


## Prerequisites

This sample **requires** prerequisites in order to run.

### Overview

This bot uses [LUIS](https://www.luis.ai), an AI based cognitive service, to implement language understanding.

- [Node.js](https://nodejs.org) version 10.14 or higher

    ```bash
    # determine node version
    node --version
    ```

### Create a LUIS Application to enable language understanding

The LUIS model for this example can be found under `cognitiveModels/FlightBooking.json` and the LUIS language model setup, training, and application configuration steps can be found [here](https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-howto-v4-luis?view=azure-bot-service-4.0&tabs=javascript).

Once you created the LUIS model, update `.env` with your `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName`.

```text
LuisAppId = "Your LUIS App Id"
LuisAPIKey = "Your LUIS Subscription key here"
LuisAPIHostName = "Your LUIS App region here (i.e: westus.api.cognitive.microsoft.com)"
```

## To try this sample

- Clone the repository

    ```bash
    git clone https://github.com/reinaw1012/ImmigrationQA.git
    ```

- Install modules

    ```bash
    npm install
    ```

- Setup LUIS

    The prerequisites outlined above contain the steps necessary to provision a language understanding model on www.luis.ai.  Refer to _Create a LUIS Application to enable language understanding_ above for directions to setup and configure LUIS.

- Run the sample

    ```bash
    npm start
    ```

## Testing the bot using Bot Framework Emulator

[Bot Framework Emulator](https://github.com/microsoft/botframework-emulator) is a desktop application that allows bot developers to test and debug their bots on localhost or running remotely through a tunnel.

- Install the Bot Framework Emulator version 4.3.0 or greater from [here](https://github.com/Microsoft/BotFramework-Emulator/releases)

### Connect to the bot using Bot Framework Emulator

- Launch Bot Framework Emulator
- File -> Open Bot
- Enter a Bot URL of `http://localhost:3978/api/messages`

