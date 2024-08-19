import asyncio
import os
from telethon import TelegramClient
from telethon.tl.types import InputPeerEmpty, Channel
from telethon.tl.functions.channels import LeaveChannelRequest
from telethon.tl.functions.channels import GetFullChannelRequest
from config import API_ID, API_HASH, PHONE_NUMBER

api_id = API_ID
api_hash = API_HASH
phone_number = PHONE_NUMBER
session_file = 'anon.session'

client = None
loop = None

AVATAR_FOLDER = os.path.join('static', 'avatars')

def get_event_loop():
    global loop
    if loop is None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop

async def get_client():
    global client
    if client is None:
        client = TelegramClient(session_file, api_id, api_hash)
        await client.start(phone=phone_number)
    return client

async def save_avatar(client, channel):
    avatar_path = os.path.join(AVATAR_FOLDER, f'{channel.id}.jpg')
    try:
        await client.download_profile_photo(channel, file=avatar_path)
        return f'/static/avatars/{channel.id}.jpg'
    except Exception as e:
        print(f"Error saving avatar for channel {channel.id}: {e}")
        return ''

async def get_inactive_channels_async(unread_threshold=100):
    client = await get_client()
    inactive_channels = []

    async for dialog in client.iter_dialogs():
        if isinstance(dialog.entity, Channel):
            if dialog.unread_count > unread_threshold:
                channel_link = f"tg://resolve?domain={dialog.entity.username}" if dialog.entity.username else f"tg://channel?id={dialog.entity.id}"
                avatar_url = await save_avatar(client, dialog.entity)
                inactive_channels.append({
                    'id': dialog.entity.id,
                    'title': dialog.entity.title,
                    'unread_count': dialog.unread_count,
                    'link': channel_link,
                    'avatar_url': avatar_url
                })

    return inactive_channels

def get_inactive_channels():
    loop = get_event_loop()
    return loop.run_until_complete(get_inactive_channels_async())

async def unsubscribe_from_channels_async(channel_ids):
    client = await get_client()
    results = []
    for channel_id in channel_ids:
        try:
            channel = await client.get_entity(channel_id)
            await client(LeaveChannelRequest(channel))
            avatar_path = os.path.join(AVATAR_FOLDER, f'{channel_id}.jpg')
            if os.path.exists(avatar_path):
                os.remove(avatar_path)
            results.append({'id': channel_id, 'success': True})
        except Exception as e:
            print(f"Error unsubscribing from channel {channel_id}: {e}")
            results.append({'id': channel_id, 'success': False})
    return results

def unsubscribe_from_channels(channel_ids):
    loop = get_event_loop()
    return loop.run_until_complete(unsubscribe_from_channels_async(channel_ids))


