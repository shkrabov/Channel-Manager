from flask import Flask, render_template, jsonify, send_from_directory, Response, request
from telegram_client import get_inactive_channels, unsubscribe_from_channels, get_event_loop, AVATAR_FOLDER
import asyncio
import os
import json

app = Flask(__name__)

app.config['AVATAR_FOLDER'] = AVATAR_FOLDER

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_inactive_channels')
def inactive_channels():
    def generate():
        try:
            channels = get_inactive_channels()
            for channel in channels:
                yield json.dumps(channel) + '\n'
        except Exception as e:
            print(f"Error getting inactive channels: {e}")
            yield json.dumps({'error': str(e)}) + '\n'

    return Response(generate(), mimetype='application/json')

@app.route('/unsubscribe', methods=['POST'])
def unsubscribe():
    channel_ids = request.json.get('channel_ids', [])
    try:
        results = unsubscribe_from_channels(channel_ids)
        return jsonify(results)
    except Exception as e:
        print(f"Error unsubscribing from channels: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/static/avatars/<path:filename>')
def serve_avatar(filename):
    return send_from_directory(app.config['AVATAR_FOLDER'], filename)

if __name__ == '__main__':
    loop = get_event_loop()
    asyncio.set_event_loop(loop)
    
    # Создаем папку для аватарок, если она не существует
    os.makedirs(AVATAR_FOLDER, exist_ok=True)
    
    app.run(debug=True, use_reloader=False)
