let allChannels = [];
let isLoading = false;

document.addEventListener('DOMContentLoaded', () => {
    localStorage.removeItem('selectedChannels'); // Очищаем сохраненные выбранные каналы
    fetchInactiveChannels();
    document.getElementById('minUnread').addEventListener('input', applyFilters);
    document.getElementById('maxUnread').addEventListener('input', applyFilters);
    document.getElementById('unsubscribeSelected').addEventListener('click', unsubscribeSelected);
    document.getElementById('cancelSelection').addEventListener('click', cancelSelection);
    document.getElementById('sort-select').addEventListener('change', sortChannels);
});

function showSkeletons(count = 10) {
  const channelList = document.getElementById('channel-list');
  channelList.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'channel skeleton';
    skeleton.innerHTML = `
      <div class="channel-left">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-info">
          <div class="skeleton-title"></div>
          <div class="skeleton-unread"></div>
        </div>
      </div>
      <div class="channel-right">
        <div class="skeleton-button"></div>
      </div>
    `;
    channelList.appendChild(skeleton);
  }
}


function removeSkeletons() {
    const skeletons = document.querySelectorAll('.skeleton');
    skeletons.forEach(skeleton => skeleton.remove());
}

async function fetchInactiveChannels() {
    if (isLoading) return;
    isLoading = true;
    showSkeletons();
    
    try {
        const response = await fetch('/get_inactive_channels');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        // Очищаем массив allChannels перед новой загрузкой
        allChannels = [];
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const channels = parseChannels(buffer);
            
            // Добавляем только уникальные каналы
            channels.forEach(channel => {
                if (!allChannels.some(c => c.id === channel.id)) {
                    allChannels.push(channel);
                }
            });
            
            sortChannels();
            displayChannels(allChannels);
        }
    } catch (error) {
        console.error('Error fetching channels:', error);
        const channelList = document.getElementById('channel-list');
        channelList.innerHTML = '<p>Произошла ошибка при загрузке каналов. Пожалуйста, попробуйте позже.</p>';
    } finally {
        isLoading = false;
        removeSkeletons();
    }
}

function parseChannels(buffer) {
    const channels = [];
    const lines = buffer.split('\n');
    for (const line of lines) {
        if (line.trim()) {
            try {
                const channel = JSON.parse(line);
                channels.push(channel);
            } catch (e) {
                // Игнорируем неполные JSON объекты
            }
        }
    }
    return channels;
}

function displayChannels(channels) {
    const channelList = document.getElementById('channel-list');
    channelList.innerHTML = '';
    channels.forEach(channel => {
        const channelElement = document.createElement('div');
        channelElement.className = 'channel';
        channelElement.innerHTML = `
            <div class="channel-left" onclick="toggleChannel(this, ${channel.id})">
                <input type="checkbox" id="channel-${channel.id}">
                <img src="${channel.avatar_url}" alt="${channel.title}" class="channel-avatar">
                <div class="channel-info">
                    <h3>${channel.title}</h3>
                    <span class="unread-count">${channel.unread_count} непрочитанных</span>
                </div>
            </div>
            <div class="channel-right">
                <button onclick="openChannel('${channel.link}')" class="btn btn-secondary">Открыть</button>
            </div>
        `;
        channelList.appendChild(channelElement);
    });
    updateActionButtons();
}

function openChannel(link) {
    window.location.href = link;
}

function toggleChannel(element, channelId) {
    const checkbox = element.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    updateSelectedChannels(channelId, checkbox.checked);
}

function updateSelectedChannels(channelId, isSelected) {
    const selectedChannels = JSON.parse(localStorage.getItem('selectedChannels') || '[]');
    if (isSelected) {
        selectedChannels.push(channelId);
    } else {
        const index = selectedChannels.indexOf(channelId);
        if (index > -1) {
            selectedChannels.splice(index, 1);
        }
    }
    localStorage.setItem('selectedChannels', JSON.stringify(selectedChannels));
    updateActionButtons();
}

function updateActionButtons() {
    const selectedChannels = JSON.parse(localStorage.getItem('selectedChannels') || '[]');
    const unsubscribeButton = document.getElementById('unsubscribeSelected');
    const cancelButton = document.getElementById('cancelSelection');
    
    unsubscribeButton.disabled = selectedChannels.length === 0;
    unsubscribeButton.textContent = `Отписаться (${selectedChannels.length})`;
    
    cancelButton.disabled = selectedChannels.length === 0;
}

function unsubscribeSelected() {
    const selectedChannels = JSON.parse(localStorage.getItem('selectedChannels') || '[]');
    if (selectedChannels.length > 0 && confirm(`Вы уверены, что хотите отписаться от ${selectedChannels.length} выбранных каналов?`)) {
        performUnsubscribe(selectedChannels);
    }
}

function performUnsubscribe(channelIds) {
    fetch('/unsubscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel_ids: channelIds }),
    })
    .then(response => response.json())
    .then(results => {
        const successCount = results.filter(r => r.success).length;
        alert(`Вы успешно отписались от ${successCount} каналов`);
        
        // Удаляем отписанные каналы из локального списка
        allChannels = allChannels.filter(channel => !results.find(r => r.success && r.id === channel.id));
        displayChannels(allChannels);
        
        localStorage.setItem('selectedChannels', '[]');
        updateActionButtons();
    })
    .catch(error => {
        console.error('Error unsubscribing:', error);
        alert('Произошла ошибка при отписке от каналов');
    });
}

function cancelSelection() {
    localStorage.setItem('selectedChannels', '[]');
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    updateActionButtons();
}

function applyFilters() {
    const minUnread = parseInt(document.getElementById('minUnread').value) || 0;
    const maxUnread = parseInt(document.getElementById('maxUnread').value) || Infinity;
    
    const filteredChannels = allChannels.filter(channel => 
        channel.unread_count >= minUnread && channel.unread_count <= maxUnread
    );
    
    displayChannels(filteredChannels);
}

function sortChannels() {
    const sortOrder = document.getElementById('sort-select').value;
    allChannels.sort((a, b) => {
        if (sortOrder === 'desc') {
            return b.unread_count - a.unread_count;
        } else {
            return a.unread_count - b.unread_count;
        }
    });
    displayChannels(allChannels);
}



