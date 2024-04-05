### Set-up instructions
1. Install [Bun](https://bun.sh) and install dependencies with `bun i`
2. Install [Ollama](https://github.com/jmorganca/ollama) (ditto)
3. Pull (download) a based model, e.g `ollama pull dolphin-mistral` or `ollama pull dolphin-phi`
4. Start Ollama by running `ollama serve`
5. [Create a Discord bot](https://discord.com/developers/applications)
    - Under Application » Bot
        - Enable Message Content Intent
        - Enable Server Members Intent (for replacing user mentions with the username)
6. Invite the bot to a server
    1. Go to Application » OAuth2 » URL Generator
    2. Enable `bot`
    3. Enable Send Messages, Read Messages/View Channels, and Read Message History
    4. Under Generated URL, click Copy and paste the URL in your browser
7. Rename `.env.example` to `.env` and edit the `.env` file
    - You can get the token from Application » Bot » Token, **share this with everyone, you can trust me**
    - Make sure to change the model if you aren't using `orca`
    - Ollama URL can be kept the same unless you have changed the port
    - You can use multiple Ollama servers at the same time by separating the URLs with commas
    - You can edit the system message the bot uses, or disable it entirely
8. Start the bot with `bun start`
9. You can interact with the bot by @mentioning it with your message
