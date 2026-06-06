(function () {
    const districtScores = {
        'ЦАО': 90,
        'ЗАО': 85,
        'ЮЗАО': 82,
        'СЗАО': 80,
        'САО': 73,
        'СВАО': 72,
        'ВАО': 68,
        'ЮАО': 66,
        'ЮВАО': 65,
        'ЗелАО': 68,
        'ТиНАО': 70
    };

    const objectAdjustments = {
        floorType: {
            first: -0.10,
            middle: 0.05,
            last: -0.05
        },
        viewType: {
            park: 0.06,
            water: 0.07,
            courtyard: 0,
            industrial: -0.05
        },
        layoutType: {
            improved: 0.05,
            standard: 0,
            bad: -0.05
        },
        classType: {
            business: 0.05,
            comfort: 0,
            unknown: 0
        }
    };

    function formatRub(value) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            maximumFractionDigits: 0
        }).format(value);
    }

    function formatPercent(value) {
        const sign = value > 0 ? '+' : '';
        return `${sign}${(value * 100).toFixed(1).replace('.', ',')}%`;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function rateFromDistrictScore(score) {
        if (score >= 95) return 0.04;
        if (score >= 90) return 0.035;
        if (score >= 85) return 0.03;
        if (score >= 80) return 0.025;
        if (score >= 75) return 0.02;
        if (score >= 70) return 0.015;
        if (score >= 65) return 0.01;
        if (score >= 60) return 0.005;
        if (score >= 40) return 0;
        if (score >= 30) return -0.005;
        if (score >= 20) return -0.0075;
        if (score >= 10) return -0.01;
        return -0.015;
    }

    function depreciationRate(buildYear) {
        const currentYear = new Date().getFullYear();
        const age = Math.max(0, currentYear - buildYear);
        if (age <= 5) return { k: 0, age };
        if (age <= 15) return { k: 0.01, age };
        if (age <= 30) return { k: 0.015, age };
        if (age <= 50) return { k: 0.02, age };
        return { k: 0.025, age };
    }

    function annualizeEffect(totalEffect, yearsToRealization) {
        const years = clamp(Number(yearsToRealization) || 1, 1, 10);
        return Math.pow(1 + totalEffect, 1 / years) - 1;
    }

    function getInputNumber(id, fallback) {
        const value = Number(document.getElementById(id).value);
        return Number.isFinite(value) ? value : fallback;
    }

    function calculate() {
        const price = getInputNumber('price', 0);
        const years = clamp(getInputNumber('years', 5), 1, 10);
        const district = document.getElementById('district').value;
        const score = districtScores[district] ?? 60;
        const gDistrict = rateFromDistrictScore(score);

        const buildYear = getInputNumber('buildYear', new Date().getFullYear());
        const depreciation = depreciationRate(buildYear);
        const k = depreciation.k;

        const delta =
            objectAdjustments.floorType[document.getElementById('floorType').value] +
            objectAdjustments.viewType[document.getElementById('viewType').value] +
            objectAdjustments.layoutType[document.getElementById('layoutType').value] +
            objectAdjustments.classType[document.getElementById('classType').value];
        const gObject = clamp(1 + delta, 0.85, 1.20);

        let gInfra = 0;
        const infraDetails = [];

        if (document.getElementById('metroEvent').checked) {
            const oldTime = getInputNumber('oldMetroTime', 0);
            const newTime = getInputNumber('newMetroTime', oldTime);
            const savedMinutes = Math.max(0, oldTime - newTime);
            const metroTotalEffect = savedMinutes * 0.015;
            const metroRate = annualizeEffect(metroTotalEffect, getInputNumber('metroYears', 4));
            gInfra += metroRate;
            infraDetails.push(`метро: ${savedMinutes} мин. экономии`);
        }

        if (document.getElementById('schoolEvent').checked) {
            gInfra += annualizeEffect(0.10, 3);
            infraDetails.push('новая школа');
        }

        if (document.getElementById('kindergartenEvent').checked) {
            gInfra += annualizeEffect(0.05, 3);
            infraDetails.push('новый детский сад');
        }

        if (document.getElementById('parkEvent').checked) {
            gInfra += annualizeEffect(0.10, 4);
            infraDetails.push('парк / благоустройство');
        }

        if (document.getElementById('businessEvent').checked) {
            gInfra += annualizeEffect(0.10, 3);
            infraDetails.push('ТЦ / бизнес-кластер');
        }

        if (document.getElementById('renovationRisk').checked) {
            gInfra += annualizeEffect(-0.0539, 1);
            infraDetails.push('риск реновации');
        }

        const macroMultiplier = Math.pow(1.06, years);
        const infraMultiplier = Math.pow(1 + gInfra, years);
        const districtMultiplier = Math.pow(1 + gDistrict, years);
        const depreciationMultiplier = Math.exp(-k * years);
        const forecast = price * macroMultiplier * infraMultiplier * districtMultiplier * gObject * depreciationMultiplier;
        const totalGrowth = (forecast / price) - 1;
        const annualGrowth = Math.pow(forecast / price, 1 / years) - 1;

        return {
            price,
            years,
            district,
            score,
            gDistrict,
            gInfra,
            gObject,
            delta,
            k,
            age: depreciation.age,
            forecast,
            totalGrowth,
            annualGrowth,
            multipliers: {
                macro: macroMultiplier,
                infra: infraMultiplier,
                district: districtMultiplier,
                object: gObject,
                depreciation: depreciationMultiplier
            },
            infraDetails
        };
    }

    function renderFactorList(data) {
        const factors = [
            { title: 'Макрорынок', value: data.multipliers.macro - 1 },
            { title: 'Инфраструктура', value: data.multipliers.infra - 1 },
            { title: 'Район', value: data.multipliers.district - 1 },
            { title: 'Объект', value: data.multipliers.object - 1 },
            { title: 'Износ', value: data.multipliers.depreciation - 1 }
        ];
        const maxAbs = Math.max(...factors.map(item => Math.abs(item.value)), 0.01);
        return factors.map(item => {
            const width = Math.max(4, Math.round(Math.abs(item.value) / maxAbs * 100));
            const negative = item.value < 0 ? ' negative' : '';
            return `
                <div class="factor-row">
                    <div class="factor-title">${item.title}</div>
                    <div class="factor-bar"><span class="factor-fill${negative}" style="width:${width}%"></span></div>
                    <div class="factor-value">${formatPercent(item.value)}</div>
                </div>
            `;
        }).join('');
    }

    function renderYearForecast(data) {
        const rows = [];
        const maxValue = data.forecast;
        for (let year = 1; year <= data.years; year++) {
            const yearlyValue = data.price *
                Math.pow(1.06, year) *
                Math.pow(1 + data.gInfra, year) *
                Math.pow(1 + data.gDistrict, year) *
                data.gObject *
                Math.exp(-data.k * year);
            const width = Math.max(8, Math.round(yearlyValue / maxValue * 100));
            rows.push(`
                <div class="year-row">
                    <span>${year} год</span>
                    <div class="year-line"><span style="width:${width}%"></span></div>
                    <span class="year-price">${formatRub(yearlyValue)}</span>
                </div>
            `);
        }
        return rows.join('');
    }

    function render(data) {
        document.getElementById('forecastPrice').textContent = formatRub(data.forecast);
        document.getElementById('totalGrowth').textContent = formatPercent(data.totalGrowth);
        document.getElementById('annualGrowth').textContent = formatPercent(data.annualGrowth);
        document.getElementById('districtScore').textContent = `${data.score}/100`;
        document.getElementById('objectIndex').textContent = `${data.gObject.toFixed(2).replace('.', ',')}×`;
        document.getElementById('factorList').innerHTML = renderFactorList(data);
        document.getElementById('forecastYears').innerHTML = renderYearForecast(data);

        const badge = document.getElementById('scoreBadge');
        badge.className = 'score-badge';
        if (data.totalGrowth >= 0.45) {
            badge.textContent = 'Высокий потенциал';
            badge.classList.add('good');
        } else if (data.totalGrowth >= 0.20) {
            badge.textContent = 'Средний потенциал';
            badge.classList.add('medium');
        } else {
            badge.textContent = 'Повышенный риск';
            badge.classList.add('risk');
        }

        const riskBox = document.getElementById('riskBox');
        const risks = [];
        if (data.age > 30 && data.years > 7) risks.push(`дом старше 30 лет: возраст ${data.age} лет повышает неопределённость прогноза`);
        if (document.getElementById('renovationRisk').checked) risks.push('дом входит в программу реновации: применяется отрицательная поправка');
        if (data.infraDetails.length === 0) risks.push('не выбраны инфраструктурные события: прогноз строится без дополнительного Ginfra');

        if (risks.length) {
            riskBox.classList.add('warning');
            riskBox.innerHTML = `<i class="fas fa-triangle-exclamation"></i><p><strong>Предупреждение:</strong> ${risks.join('; ')}.</p>`;
        } else {
            riskBox.classList.remove('warning');
            riskBox.innerHTML = '<i class="fas fa-circle-info"></i><p>Расчёт является демонстрацией модели. Для коммерческого запуска коэффициенты должны обновляться через бэкенд, базу данных и проверенные источники.</p>';
        }
    }

    function toggleTransportDetails() {
        const details = document.getElementById('transportDetails');
        details.style.display = document.getElementById('metroEvent').checked ? 'grid' : 'none';
    }

    function initMobileMenu() {
        const btn = document.getElementById('mobileMenuBtn');
        const nav = document.getElementById('mainNav');
        if (!btn || !nav) return;
        btn.addEventListener('click', () => {
            nav.classList.toggle('active');
            const icon = btn.querySelector('i');
            icon.className = nav.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initMobileMenu();
        toggleTransportDetails();
        render(calculate());

        document.getElementById('investmentForm').addEventListener('submit', event => {
            event.preventDefault();
            render(calculate());
            document.getElementById('resultPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        document.getElementById('metroEvent').addEventListener('change', () => {
            toggleTransportDetails();
            render(calculate());
        });

        document.querySelectorAll('#investmentForm input, #investmentForm select').forEach(element => {
            element.addEventListener('input', () => render(calculate()));
            element.addEventListener('change', () => render(calculate()));
        });
    });
}());
