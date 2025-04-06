// DOM Elements
const cityName = document.getElementById('city-name');
const temperature = document.getElementById('temperature');
const feelsLike = document.getElementById('feels-like');
const rainChance = document.getElementById('rain-chance');
const windSpeed = document.getElementById('wind-speed');
const highest = document.getElementById('highest');
const lowest = document.getElementById('lowest');
const sunset = document.getElementById('sunset');
const sunrise = document.getElementById('sunrise');
const whatToWear = document.getElementById('what-to-wear');
const weatherIcon = document.querySelector('.weather-icon i');
const hourlyForecastContainer = document.getElementById('hourly-forecast');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('i');

// Search Elements
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

// API Configuration
const API_KEY = 'bd2443b6abcbba6403e99db389cc6ae8';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Theme Functionality
function initTheme() {
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('weatherTheme');
    if (savedTheme) {
        document.body.className = savedTheme;
        updateThemeIcon(savedTheme);
    } else {
        // Use system preference as default
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.body.className = 'dark-mode';
            updateThemeIcon('dark-mode');
        }
    }
}

function toggleTheme() {
    if (document.body.classList.contains('dark-mode')) {
        document.body.className = 'light-mode';
        localStorage.setItem('weatherTheme', 'light-mode');
        updateThemeIcon('light-mode');
    } else {
        document.body.className = 'dark-mode';
        localStorage.setItem('weatherTheme', 'dark-mode');
        updateThemeIcon('dark-mode');
    }
}

function updateThemeIcon(theme) {
    if (theme === 'dark-mode') {
        themeIcon.className = 'fas fa-sun';
    } else {
        themeIcon.className = 'fas fa-moon';
    }
}

function processForecastData(forecastList) {
    if (!forecastList || !Array.isArray(forecastList) || forecastList.length === 0) {
        console.warn('Invalid forecast data', forecastList);
        return {};
    }
    
    const dailyForecasts = {};
    const currentDate = new Date();
    
    forecastList.forEach(forecast => {
        const forecastDate = new Date(forecast.dt * 1000);
        const dateKey = forecastDate.toDateString();
        
        // Skip past dates
        if (forecastDate.getDate() < currentDate.getDate() && 
            forecastDate.getMonth() === currentDate.getMonth() && 
            forecastDate.getFullYear() === currentDate.getFullYear()) {
            return;
        }
        
        if (!dailyForecasts[dateKey]) {
            dailyForecasts[dateKey] = {
                dt: forecast.dt,
                temp: forecast.main.temp,
                condition: mapWeatherCondition(forecast.weather[0].id),
                icon: forecast.weather[0].icon,
                timeDistance: Math.abs(forecastDate.getHours() - 12) 
            };
        } else {
            const timeDistance = Math.abs(forecastDate.getHours() - 12);
            if (timeDistance < dailyForecasts[dateKey].timeDistance) {
                dailyForecasts[dateKey] = {
                    dt: forecast.dt,
                    temp: forecast.main.temp,
                    condition: mapWeatherCondition(forecast.weather[0].id),
                    icon: forecast.weather[0].icon,
                    timeDistance: timeDistance
                };
            }
        }
    });
    
    return dailyForecasts;
}

function processHourlyForecastData(forecastList) {
    if (!forecastList || !Array.isArray(forecastList) || forecastList.length === 0) {
        console.warn('Invalid forecast data for hourly processing', forecastList);
        return [];
    }
    
    const hourlyForecasts = [];
    const currentTime = new Date();
    
    for (let i = 0; i < forecastList.length; i++) {
        const forecast = forecastList[i];
        const forecastTime = new Date(forecast.dt * 1000);
        
        if (forecastTime > currentTime && hourlyForecasts.length < 12) {
            hourlyForecasts.push({
                time: forecastTime,
                temp: Math.round(forecast.main.temp),
                condition: mapWeatherCondition(forecast.weather[0].id),
                rainChance: forecast.pop ? Math.round(forecast.pop * 100) : 0,
                isCurrent: i === 0
            });
        }
    }
    
    return hourlyForecasts;
}

// Functions
async function fetchWeatherData(city) {
    try {
        const currentResponse = await fetch(`${BASE_URL}/weather?q=${city}&appid=${API_KEY}&units=metric`);
        
        if (!currentResponse.ok) {
            throw new Error(`City not found or API error: ${currentResponse.statusText}`);
        }
        
        const currentData = await currentResponse.json();
        
        const forecastResponse = await fetch(`${BASE_URL}/forecast?lat=${currentData.coord.lat}&lon=${currentData.coord.lon}&appid=${API_KEY}&units=metric`);
        const forecastData = await forecastResponse.json();
        
        let highTemp = currentData.main.temp_max;
        let lowTemp = currentData.main.temp_min;
        let rainProb = 0;
        
        if (forecastData.list && forecastData.list.length > 0) {
            const today = new Date().setHours(0,0,0,0);
            const todayForecasts = forecastData.list.filter(item => {
                const itemDate = new Date(item.dt * 1000).setHours(0,0,0,0);
                return itemDate === today;
            });
            
            if (todayForecasts.length > 0) {
                todayForecasts.forEach(forecast => {
                    highTemp = Math.max(highTemp, forecast.main.temp_max);
                    lowTemp = Math.min(lowTemp, forecast.main.temp_min);
                    if (forecast.pop !== undefined) {
                        rainProb = Math.max(rainProb, forecast.pop);
                    }
                });
            }
        }
        
        const weatherData = {
            location: currentData.name + (currentData.sys.country ? ', ' + currentData.sys.country : ''),
            currentTemp: Math.round(currentData.main.temp),
            feelsLike: Math.round(currentData.main.feels_like),
            rainChance: Math.round(rainProb * 100),
            windSpeed: `${Math.round(currentData.wind.speed * 2.237)} mph`, 
            highest: Math.round(highTemp),
            lowest: Math.round(lowTemp),
            sunset: formatTime(new Date(currentData.sys.sunset * 1000)),
            sunrise: formatTime(new Date(currentData.sys.sunrise * 1000)),
            weatherCondition: mapWeatherCondition(currentData.weather[0].id)
        };
        
        updateWeatherUI(weatherData);
        updateForecast(forecastData);
        updateHourlyForecast(forecastData);
        
        // Clear the search input field after a successful search
        searchInput.value = '';
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        alert(`Failed to fetch weather data: ${error.message}`);
    }
}

function updateWeatherUI(data) {
    cityName.textContent = data.location;
    
    temperature.textContent = `${data.currentTemp}°`;
    feelsLike.textContent = `${data.feelsLike}°`;
    rainChance.textContent = `${data.rainChance}%`;
    windSpeed.textContent = data.windSpeed;
    highest.textContent = `${data.highest}°`;
    lowest.textContent = `${data.lowest}°`;
    sunset.textContent = data.sunset;
    sunrise.textContent = data.sunrise;
    whatToWear.textContent = getClothingRecommendation(data.currentTemp);
    
    updateWeatherIcon(data.weatherCondition);
    
    document.title = `${data.currentTemp}° | ${data.location}`;
}

function updateWeatherIcon(condition) {
    switch(condition) {
        case 'clear':
            weatherIcon.className = 'fas fa-sun';
            break;
        case 'partly-cloudy':
            weatherIcon.className = 'fas fa-cloud-sun';
            break;
        case 'cloudy':
            weatherIcon.className = 'fas fa-cloud';
            break;
        case 'rain':
            weatherIcon.className = 'fas fa-cloud-rain';
            break;
        case 'snow':
            weatherIcon.className = 'fas fa-snowflake';
            break;
        case 'windy':
            weatherIcon.className = 'fas fa-wind';
            break;
        case 'stormy':
            weatherIcon.className = 'fas fa-bolt';
            break;
        default:
            weatherIcon.className = 'fas fa-cloud-sun';
    }
}

function getClothingRecommendation(temperature) {
    if (temperature < 0) {
        return 'Heavy coat';
    } else if (temperature < 10) {
        return 'Warm coat';
    } else if (temperature < 15) {
        return 'Jacket';
    } else if (temperature < 20) {
        return 'Light jacket';
    } else if (temperature < 25) {
        return 'Sweater';
    } else {
        return 'T-shirt';
    }
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatHourOnly(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function mapWeatherCondition(weatherId) {
    // Thunderstorm: 200-299
    if (weatherId >= 200 && weatherId < 300) return 'stormy';
    
    // Drizzle: 300-399
    if (weatherId >= 300 && weatherId < 400) return 'rain';
    
    // Rain: 500-599
    if (weatherId >= 500 && weatherId < 600) return 'rain';
    
    // Snow: 600-699
    if (weatherId >= 600 && weatherId < 700) return 'snow';
    
    // Atmosphere (fog, haze, etc): 700-799
    if (weatherId >= 700 && weatherId < 800) return 'windy';
    
    // Clear: 800
    if (weatherId === 800) return 'clear';
    
    // Clouds: 801-899
    if (weatherId === 801) return 'partly-cloudy'; 
    if (weatherId >= 802 && weatherId <= 804) return 'cloudy'; 
    
    return 'partly-cloudy';
}

function updateForecast(forecastData) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyForecasts = processForecastData(forecastData.list);
    
    Object.keys(dailyForecasts).forEach((dateKey, index) => {
        if (index >= 7) return; 
        
        const i = index + 1;
        const dayData = dailyForecasts[dateKey];
        const dayElement = document.getElementById(`day-${i}`);
        
        if (dayElement) {
            const date = new Date(dayData.dt * 1000);
            const dayName = days[date.getDay()];
            
            const dayNameElement = dayElement.querySelector('.day-name');
            const dayTempElement = dayElement.querySelector('.day-temp');
            const iconElement = dayElement.querySelector('i');
            
            if (dayNameElement) dayNameElement.textContent = dayName;
            if (dayTempElement) dayTempElement.textContent = `${Math.round(dayData.temp)}°`;
            
            // Update the icon
            if (iconElement) {
                updateDayForecastIcon(iconElement, dayData.condition);
            }
        }
    });
}

function updateDayForecastIcon(iconElement, condition) {
    switch(condition) {
        case 'clear':
            iconElement.className = 'fas fa-sun';
            break;
        case 'partly-cloudy':
            iconElement.className = 'fas fa-cloud-sun';
            break;
        case 'cloudy':
            iconElement.className = 'fas fa-cloud';
            break;
        case 'rain':
            iconElement.className = 'fas fa-cloud-rain';
            break;
        case 'snow':
            iconElement.className = 'fas fa-snowflake';
            break;
        case 'windy':
            iconElement.className = 'fas fa-wind';
            break;
        case 'stormy':
            iconElement.className = 'fas fa-bolt';
            break;
        default:
            iconElement.className = 'fas fa-cloud-sun';
    }
}

function updateHourlyForecast(forecastData) {
    const hourlyForecastData = processHourlyForecastData(forecastData.list);
    hourlyForecastContainer.innerHTML = '';
    
    // Add the current time as the first item
    const currentHourItem = document.createElement('div');
    currentHourItem.className = 'hourly-item current';
    currentHourItem.innerHTML = `
        <span class="hour-time">Now</span>
        <i class="hourly-icon fas fa-${getWeatherIcon(mapWeatherCondition(forecastData.list[0].weather[0].id))}"></i>
        <span class="hour-temp">${Math.round(forecastData.list[0].main.temp)}°</span>
        <span class="hour-rain-chance">
            <i class="fas fa-tint"></i>
            ${Math.round(forecastData.list[0].pop * 100 || 0)}%
        </span>
    `;
    hourlyForecastContainer.appendChild(currentHourItem);
    
    // Add hourly forecast items
    hourlyForecastData.forEach(hourData => {
        const hourItem = document.createElement('div');
        hourItem.className = 'hourly-item';
        hourItem.innerHTML = `
            <span class="hour-time">${formatHourOnly(hourData.time)}</span>
            <i class="hourly-icon fas fa-${getWeatherIcon(hourData.condition)}"></i>
            <span class="hour-temp">${hourData.temp}°</span>
            <span class="hour-rain-chance">
                <i class="fas fa-tint"></i>
                ${hourData.rainChance}%
            </span>
        `;
        hourlyForecastContainer.appendChild(hourItem);
    });
}

function getWeatherIcon(condition) {
    switch(condition) {
        case 'clear':
            return 'sun';
        case 'partly-cloudy':
            return 'cloud-sun';
        case 'cloudy':
            return 'cloud';
        case 'rain':
            return 'cloud-rain';
        case 'snow':
            return 'snowflake';
        case 'windy':
            return 'wind';
        case 'stormy':
            return 'bolt';
        default:
            return 'cloud-sun';
    }
}

// Search functionality
function handleSearch() {
    const city = searchInput.value.trim();
    if (city) {
        fetchWeatherData(city);
        searchInput.blur(); // Remove focus from the input
    }
}

// Initialize the page with default data
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();
    
    // Add theme toggle event listener
    themeToggle.addEventListener('click', toggleTheme);
    
    // Fetch initial weather data
    fetchWeatherData('Mississauga');
    
    // Add search functionality
    searchButton.addEventListener('click', handleSearch);
    
    // Allow pressing Enter key to search
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });
});