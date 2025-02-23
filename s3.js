import { bucketName, s3Domain } from "./config.js"

const objectList = document.getElementById('object-list');
const breadcrumb = document.getElementById('breadcrumb');
const searchInput = document.getElementById('search');
const loading = document.getElementById('loading');
const errorAlert = document.getElementById('error');
const itemsPerPage = 10;

let totalPages = 0;
let currentPage = 1;
let currentPath = '';

function isFolder(key) {
  return key.endsWith('/');
}

function isHTML(key) {
  return key.endsWith('html');
}

function createDownloadLink(key) {
  let urlEncodedKey = encodeURIComponent(key)
  const url = `https://${bucketName}.${s3Domain}/${urlEncodedKey}`;
  const link = document.createElement('a');
  link.href = url;

  // Create the icon element
  const icon = document.createElement('i');
  icon.className = isFolder(key) ? 'fas fa-folder mr-2' : 'fas fa-file mr-2';

  // Create the span element to hold the text
  const textSpan = document.createElement('span');

  if (isFolder(key)) {
    textSpan.textContent = key.slice(0, -1).split('/').pop();
  } else {
    textSpan.textContent = key.split('/').pop();
    if (!isHTML(key)) {
      link.setAttribute('download', '');
    }
  }

  // Append the icon and the text span to the link
  link.appendChild(icon);
  link.appendChild(textSpan);

  return link;
}


function navigateTo(path) {
  currentPath = path;
  listObjects(currentPath);
}

function updateBreadcrumb(path) {
  const parts = path.split('/').filter((part) => part);
  let crumbPath = '';

  breadcrumb.innerHTML = '<li class="breadcrumb-item"><a href="index.html">Home</a></li>';

  parts.forEach((part, index) => {
    crumbPath += part + '/';
    const listItem = document.createElement('li');
    listItem.className = 'breadcrumb-item';

    if (index === parts.length - 1) {
      listItem.textContent = part;
      listItem.classList.add('active');
    } else {
      const link = document.createElement('a');
      link.href = crumbPath;
      link.textContent = part;
      let thisCrumbPath = crumbPath;
      link.onclick = (e) => {
        currentPage = 1
        e.preventDefault();
        navigateTo(thisCrumbPath);
      }
      listItem.appendChild(link);
    }

    breadcrumb.appendChild(listItem);
  });
}

function formatSize(size) {
  if (isNaN(size)) {
    return 'Unknown';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index;

  for (index = 0; size >= 1024 && index < units.length - 1; index++) {
    size /= 1024;
  }

  return `${size.toFixed(2)} ${units[index]}`;
}

function listObjects(path, continuationToken = null) {
  const prefix = path ? `prefix=${path}&` : '';
  const maxKeys = 1000;
  let url = `https://${bucketName}.${s3Domain}/?list-type=2&${prefix}delimiter=%2F&max-keys=${maxKeys}`;

  if (continuationToken) {
    url += `&continuation-token=${encodeURIComponent(continuationToken)}`;
  }

  loading.classList.remove('d-none');
  errorAlert.classList.add('d-none');

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error fetching objects: ${response.status}`);
      }
      return response.text();
    })
    .then((text) => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      const keys = xmlDoc.getElementsByTagName('Key');
      const prefixes = xmlDoc.getElementsByTagName('Prefix');

      const isTruncated = xmlDoc.querySelector('IsTruncated')?.textContent === 'true';
      const nextContinuationToken = xmlDoc.querySelector('NextContinuationToken')?.textContent;

      // If this is a fresh request (no continuation token), clear the list
      if (!continuationToken) {
        objectList.innerHTML = '';
      }

      // Process current batch of prefixes
      Array.from(prefixes).forEach((prefix) => {
        const key = prefix.textContent;
        if (key === path) {
          return;
        }
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        const link = createDownloadLink(key);

        link.onclick = (e) => {
          e.preventDefault();
          navigateTo(key);
        };

        nameCell.appendChild(link);
        row.appendChild(nameCell);
        row.insertCell(-1).textContent = ''; // Empty cells for last modified and size
        row.insertCell(-1).textContent = '';
        objectList.appendChild(row);
      });

      // Process current batch of keys
      Array.from(keys).forEach((keyElement) => {
        const key = keyElement.textContent;
        if (key === 'index.html' || key === 's3.js' || key === 'dark-mode.css' || key === 'config.js') {
          return;
        }
        if (key === path) {
          return;
        }

        const lastModified = new Date(keyElement.nextElementSibling.textContent);
        const sizeElement = keyElement.parentNode.querySelector('Size');
        const size = sizeElement ? parseInt(sizeElement.textContent, 10) : NaN;
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        const link = createDownloadLink(key);

        nameCell.appendChild(link);
        row.appendChild(nameCell);
        row.insertCell(-1).textContent = lastModified.toLocaleString();
        row.insertCell(-1).textContent = formatSize(size);
        objectList.appendChild(row);
      });

      // If there are more items to fetch, get them
      if (isTruncated && nextContinuationToken) {
        listObjects(path, nextContinuationToken);
      } else {
        // Apply pagination after all items are fetched
        const rows = Array.from(objectList.getElementsByTagName('tr'));
        const totalItems = rows.length;
        totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

        // Hide all rows first
        rows.forEach(row => row.style.display = 'none');

        // Show only rows for current page
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        rows.slice(startIndex, endIndex).forEach(row => row.style.display = '');

        updateBreadcrumb(path);
        updatePaginationControls();
        loading.classList.add('d-none');
      }
    })
    .catch((error) => {
      console.error('Error fetching objects:', error);
      loading.classList.add('d-none');
      errorAlert.textContent = `Error fetching objects: ${error.message}`;
      errorAlert.classList.remove('d-none');
    });
}

searchInput.addEventListener('input', (e) => {
  const filter = e.target.value.toLowerCase();
  const rows = objectList.getElementsByTagName('tr');

  for (let i = 0; i < rows.length; i++) {
    const nameCell = rows[i].getElementsByTagName('td')[0];
    const name = nameCell.textContent || nameCell.innerText;

    if (name.toLowerCase().indexOf(filter) > -1) {
      rows[i].style.display = '';
    } else {
      rows[i].style.display = 'none';
    }
  }
});

const darkModeSwitch = document.getElementById('darkModeSwitch');

darkModeSwitch.addEventListener('change', (e) => {
  const darkModeStyle = document.getElementById('dark-mode-style');
  if (e.target.checked) {
    darkModeStyle.disabled = false;
    localStorage.setItem('darkMode', 'true');
  } else {
    darkModeStyle.disabled = true;
    localStorage.setItem('darkMode', 'false');
  }

});

const darkModeStyle = document.getElementById('dark-mode-style');
if (localStorage.getItem('darkMode') === 'true') {
  darkModeSwitch.checked = true;
  darkModeStyle.disabled = false;
} else {
  darkModeSwitch.checked = false;
  darkModeStyle.disabled = true;
}

navigateTo('');

// Pagination controls logic
document.getElementById('prevPage').addEventListener('click', function() {
  currentPage = Math.max(currentPage - 1, 1);
  listObjects(currentPath);
});

document.getElementById('nextPage').addEventListener('click', function() {
  currentPage = Math.min(currentPage + 1, totalPages);
  listObjects(currentPath);
});

function updatePaginationControls() {
  document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById('prevPage').disabled = currentPage <= 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
}
