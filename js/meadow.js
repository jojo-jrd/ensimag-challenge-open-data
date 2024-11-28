const animalColors = {
    saumon: ['#6fc1d3', 'rgb(0 63 102)', 'rgb(168 199 250)'],
    vache: ['brown', '#2D2926', '#ed6f63'],
    cochon: ['#825838', '#d3687f', '#CBCE91'],
    poule: ['#d66e06', 'brown', 'cream'],
    mouton: ['#717171', '#caa785', '#72533f']
};

let currentAnimal;

document.addEventListener('DOMContentLoaded', function () {
    // Créer le conteneur pour le graphique
    let chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'chart-container';
        chartContainer.innerHTML = `
            <div id="chart-wrapper" style="display:none; position: absolute; transform: translateX(-50%); left: 50%; top: 50%; z-index: 3; background: white; padding: 20px; border: 1px solid #ccc; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 class="chart-title">Évolution des Salaires, Prix et Consommation de ${currentAnimal} en France</h2>
                <div id="chart"></div>
                <div id="tooltip" style="position: absolute; opacity: 0; pointer-events: none; background: white; border: 1px solid #ccc; padding: 10px; border-radius: 5px;"></div>
            </div>
        `;
        document.body.appendChild(chartContainer);
    }

    // Fonction pour mettre à jour le titre
    function updateChartTitle(animal) {
        if (animal=="Saumon"){
            animal="Poisson";
        }else{
            animal ="Viande de "+animal
        }
        const titleElement = document.querySelector('.chart-title'); // Sélectionner par classe
        if (titleElement) {
            titleElement.textContent = `Évolution des Salaires, Prix et Consommation de ${animal} en France`;
        }
    }

    function createCombinationChart(animal) {
        console.log("Création du graphique combiné pour :", animal);
        animal = animal.toLowerCase();
    
        // Nettoyer le conteneur avant de créer un nouveau graphique
        d3.select("#chart").selectAll("*").remove();
    
        const margin = { top: 50, right: 60, bottom: 50, left: 50 };
        const width = 700 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
    
        const svg = d3.select("#chart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    
        // Charger les fichiers CSV en parallèle
        Promise.all([
            d3.csv("../csv/salaires-fr.csv"),
            d3.csv(`../csv/conso-${animal}.csv`),
            d3.csv(`../csv/prix-${animal}.csv`)
        ]).then(([salaryData, animalData, priceData]) => {
            // Préparer les données (comme dans ton code original)
            salaryData.forEach(d => {
                d.année = +d.année;
                d.ensemble = +d.ensemble;
            });
    
            animalData.forEach(d => {
                d.année = +d.année;
                d.conso_viande = +d.conso_viande;
            });
    
            priceData.forEach(d => {
                d.année = +d.année;
                d.prix_moy = +d.prix_moy;
            });
    
            // Fusionner les données par année
            const mergedData = salaryData.map(s => {
                const animal = animalData.find(f => f.année === s.année);
                const price = priceData.find(f => f.année === s.année);
                return {
                    année: s.année,
                    ensemble: s.ensemble,
                    conso_viande: animal ? animal.conso_viande : null,
                    prix_moy: price ? price.prix_moy : null
                };
            });
    
            // Échelles AVEC ANIMATION DE TRANSITION
            const x = d3.scaleLinear()
                .domain(d3.extent(mergedData, d => d.année))
                .range([0, width]);
    
            const yLeft = d3.scaleLinear()
                .domain([300, 380])
                .range([height, 0]);
    
            const yRight = d3.scaleLinear()
                .domain([0, d3.max(mergedData, d => d.conso_viande) + d3.max(mergedData, d => d.conso_viande)/2])
                .range([height, 0]);
    
            const yRight2 = d3.scaleLinear()
                .domain([0, d3.max(mergedData, d => d.prix_moy)])
                .range([height, 0]);
    
            // AXES AVEC TRANSITIONS
            // Axe X
            svg.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x).tickFormat(d3.format("d")))
                .attr("stroke", "#333")
                .style("opacity", 0)
                .transition()
                .duration(1000)
                .style("opacity", 1);
    
            // Axe Y Salaires
            svg.append("g")
                .attr("class", "y-axis-salaires")
                .call(d3.axisLeft(yLeft))
                .attr("color", animalColors[animal][0])
                .style("opacity", 0)
                .transition()
                .duration(1000)
                .style("opacity", 1);
    
            // Axe Y Consommation
            svg.append("g")
                .attr("class", "y-axis-conso")
                .attr("transform", `translate(${width},0)`)
                .call(d3.axisRight(yRight))
                .attr("color", animalColors[animal][1])
                .style("opacity", 0)
                .transition()
                .duration(1000)
                .style("opacity", 1);
    
            // Axe Y Prix
            svg.append("g")
                .attr("class", "y-axis-prix")
                .attr("transform", `translate(${width + 30},0)`)
                .call(d3.axisRight(yRight2))
                .attr("color", animalColors[animal][2])
                .style("opacity", 0)
                .transition()
                .duration(1000)
                .style("opacity", 1);
    
            // BARRES DE CONSOMMATION AVEC TRANSITION
            svg.selectAll(".bar-conso")
                .data(mergedData)
                .enter()
                .append("rect")
                .attr("class", "bar-conso")
                .attr("x", d => x(d.année) - 10)
                .attr("y", height) // Commence en bas
                .attr("width", 10)
                .attr("height", 0) // Commence à zéro
                .attr("fill", animalColors[animal][1])
                .transition()
                .duration(1500)
                .attr("y", d => yRight(d.conso_viande))
                .attr("height", d => height - yRight(d.conso_viande));
    
            // BARRES DE PRIX AVEC TRANSITION 
            svg.selectAll(".bar-prix")
                .data(mergedData)
                .enter()
                .append("rect")
                .attr("class", "bar-prix")
                .attr("x", d => x(d.année))
                .attr("y", height) // Commence en bas
                .attr("width", 10)
                .attr("height", 0) // Commence à zéro
                .attr("fill", animalColors[animal][2])
                .transition()
                .duration(1500)
                .attr("y", d => yRight2(d.prix_moy))
                .attr("height", d => height - yRight2(d.prix_moy));
    
            // COURBE DE SALAIRE AVEC TRANSITION
            const line = d3.line()
                .x(d => x(d.année))
                .y(d => yLeft(d.ensemble));
    
            svg.append("path")
                .datum(mergedData)
                .attr("fill", "none")
                .attr("stroke", animalColors[animal][0])
                .attr("stroke-width", 4)
                .attr("d", line)
                // Animation de dessin de ligne
                .attr("stroke-dasharray", function() {
                    const length = this.getTotalLength();
                    return `${length} ${length}`;
                })
                .attr("stroke-dashoffset", function() {
                    return this.getTotalLength();
                })
                .transition()
                .duration(2000)
                .ease(d3.easeLinear)
                .attr("stroke-dashoffset", 0);
    

            // Légende
            const legend = svg.append("g")
                .attr("transform", `translate(${width / 3 - 100}, ${height + 30})`); // Positionner la légende au centre en bas du graphique

            // Légende pour l'indice de salaire
            legend.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", animalColors[animal][0]); // Couleur de la courbe des salaires

            legend.append("text")
                .attr("x", 15)
                .attr("y", 10)
                .text("Indice de Salaire") // Texte explicatif
                .style("font-size", "12px")
                .attr("fill", animalColors[animal][0]);

            // Légende pour la consommation de poisson
            legend.append("rect")
                .attr("x", 120) // Décalage horizontal
                .attr("y", 0)
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", animalColors[animal][1]); // Couleur des barres de consommation de poisson

            legend.append("text")
                .attr("x", 135) // Décalage horizontal
                .attr("y", 10)
                .text("Consommation de "+animal+" (kg/hab)")
                .style("font-size", "12px")
                .attr("fill", animalColors[animal][1]);

            // Légende pour le prix moyen
            legend.append("rect")
                .attr("x", 340) // Décalage horizontal
                .attr("y", 0)
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", animalColors[animal][2]); // Couleur des barres du prix moyen

            legend.append("text")
                .attr("x", 355) // Décalage horizontal
                .attr("y", 10)
                .text("Prix Moyen (indice)")
                .style("font-size", "12px")
                .attr("fill", animalColors[animal][2]);



        }).catch(function (error) {
            console.error("Erreur lors du chargement des fichiers CSV :", error);
        });
    }

    // Modification du script d'événements
    const animals = document.querySelectorAll('.animal');
    const chartWrapper = document.getElementById('chart-wrapper');

    animals.forEach(animal => {
        animal.addEventListener('click', function (event) {
            console.log('Animal cliqué : ' + this.getAttribute('alt'));
            updateChartTitle(this.getAttribute('alt'));
            animals.forEach(a => a.classList.remove('active'));

            if (!this.classList.contains('active')) {
                this.classList.add('active');

  
                createCombinationChart(this.getAttribute('alt')); // Crée le graphique combiné
			    // Positionne le graphique au milieu du content-box
                const contentBox = document.querySelector('.content-box');
                if (contentBox) {
                    const boxRect = contentBox.getBoundingClientRect();
                    chartWrapper.style.position = 'absolute';
                    chartWrapper.style.top = `${boxRect.top + window.scrollY}px`;
                    chartWrapper.style.display = 'block';
                    chartWrapper.style.borderRadius= '255px 15px 225px 15px / 15px 225px 15px 255px';
                    chartWrapper.style.background= 'rgb(255 255 255)';
                    chartWrapper.style.border= 'dashed 5px rgb(72 77 100)';

                }


                chartWrapper.style.display = 'block';
            } else {
                chartWrapper.style.display = 'none';
            }

            event.stopPropagation();
        });
    });

    document.addEventListener('click', function () {
        animals.forEach(a => a.classList.remove('active'));
        chartWrapper.style.display = 'none';
    });
});