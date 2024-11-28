import csv

# Lire les données depuis le fichier CSV
result = {}

with open('prix-saumon2.csv', mode='r') as file:
    reader = csv.reader(file, delimiter='\t')
    for row in reader:
        year = row[0]  # Récupérer l'année
        value_str = row[2].replace(',', '.')  # Remplacer la virgule par un point pour la conversion
        value = float(value_str)  # Convertir la valeur en float
        
        if year not in result:
            result[year] = []
        result[year].append(value)  # Ajouter la valeur à la liste de l'année

# Calculer la moyenne et afficher les résultats
for year in sorted(result.keys()):  # Trier les années par ordre croissant
    if result[year]:  # Vérifier si la liste n'est pas vide
        average = sum(result[year]) / len(result[year])  # Calcul de la moyenne
        print(f"{year},{average:.2f}")  # Afficher l'année et la moyenne avec deux décimales
    else:
        print(f"{year},N/A")  # Afficher N/A si aucune donnée