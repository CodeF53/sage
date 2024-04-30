## Set-up instructions
1. Install [Bun](https://bun.sh) and install dependencies with `bun i`
2. [Create a Discord bot](https://discord.com/developers/applications)
    - enable `Message Content Intent` and `Server Members Intent` in `Application` > `Bot`
3. Create `/configs/botName.private.env`
    ```sh
    TOKEN=...
    APP_ID=...
    ```
4. Invite the bot to a server with:
  - `https://discord.com/oauth2/authorize?permissions=68608&scope=bot&client_id=`+`YOUR APP_ID`
5. **TEMPORARY** install NodeJS and run `bun start-node`
    - Applies until bun gets [brotli compression](https://github.com/oven-sh/bun/issues/267) and [some `dgram` APIs](https://github.com/oven-sh/bun/issues/10381)
6. start with `bun start`

All configs can be found in either:
- `.env` (Global Config)
- `./configs/*.env` (Per-Bot config)
- `./configs/*.private.env` (Bot Credential config)

You can run more than one bot at once by creating more in `./configs/`

## LLM setup
1. Install [Ollama](https://github.com/jmorganca/ollama)
2. Download an model ex: `ollama pull dolphin-mistral`
3. Start Ollama by running `ollama serve`

## Image Generation setup
1. setup [This WebUI](https://github.com/lllyasviel/stable-diffusion-webui-forge)
2. add `--api --nowebui` to `COMMANDLINE_ARGS` in `webui-user.sh`
3. run it in the background whenever you run the bot

## Voice Channel Stuff
1. [Install FFMPEG](https://ffmpeg.org)
