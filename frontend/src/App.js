import React, { useState } from "react";

/* Dining Hall Images */
import anteateryImg from "./anteatery.jpg";
import brandyImg from "./brandywine.jpg"

const baseUrl = "https://zotmacros.onrender.com"

function Main() {
  const [activeTab, setActiveTab] = useState("Brandywine");

  const getImageForTab = () => {
    if (activeTab === "Anteatery") return anteateryImg;
    if (activeTab === "Brandywine") return brandyImg;
    return null;
  };

  return (
    <div>
      {/* Image at top */}
      <div style={{ position: "relative" }}>
        <ImageLoader src={getImageForTab()} alt={activeTab} />
        <MixedTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Scrollable content below */}
      <div style={{ padding: "20px" }}>
        <LoadContent tab ={activeTab}/>
      </div>
    </div>
  );
}
function MixedTabs({activeTab, setActiveTab}) {
  const [dropdownOpen, setDropdownOpen] = useState(false); // dropdown open state
  const [prevActiveTab, setPrevTab] = useState("Brandywine")

  const dropdownItems = ["Brandywine", "Anteatery"];

  return (
    <div
      style={{
        position: "fixed",
        top: "0px",
        height: "4%",
        width: "100%",
        display: "flex",
        gap: "0px",
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        padding: "5px 10px",
        borderRadius: "0px",
        zIndex: 1000,
      }}
    >
      <div style={{ width: "100%", margin: "0px auto", fontFamily: "sans-serif" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: "10px" }}>
          {/* Dropdown tab */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                padding: "10px 20px",
                cursor: "pointer",
                borderBottom: activeTab !== "Dietary Plan" ? "2px solid blue" : "2px solid transparent",
              }}
            >
              {prevActiveTab} ⌵
            </div>

            {/* Dropdown content */}
            {dropdownOpen && (
              <ul
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  border: "1px solid #ccc",
                  borderRadius: "5px",
                  background: "white",
                  zIndex: 10,
                  width: "100%",
                }}
              >
                {dropdownItems.map((item) => (
                  <li
                    key={item}
                    onClick={() => {
                      setActiveTab(item);
                      setDropdownOpen(false);
                      setPrevTab(item)
                    }}
                    style={{
                      padding: "8px 10px",
                      cursor: "pointer",
                      background: activeTab === item ? "#eee" : "transparent",
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Normal tab */}
          <div
            onClick={() => {
              setActiveTab("Dietary Plan");
              setPrevTab("Menu")
              setDropdownOpen(false); // close dropdown if open
            }}
            style={{
              padding: "10px 20px",
              cursor: "pointer",
              borderBottom: activeTab === "Dietary Plan" ? "2px solid blue" : "2px solid transparent",
            }}
          >
            Dietary Plan
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadContent({ tab }) {
  if (tab === "Anteatery") return <LoadAnteateryContent />;
  if (tab === "Brandywine") return <LoadBrandywineContent />;
  return <LoadDietaryPlanContent />;
}

function LoadAnteateryContent(){
  return (
    <div>
      <GetGroups tab = "anteatery"/>
    </div>
  )
}
function LoadBrandywineContent(){
  return (
    <div>
      <GetGroups tab = "brandywine"/>
    </div>
  )
}
function LoadDietaryPlanContent() {
  const [goals, setGoals] = useState({
    calorie_goal: 0,
    protein_goal: 0,
    calories_consumed: 0,
    protein_consumed: 0,
  });

  const [loggedFoods, setLoggedFoods] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const refreshAll = async () => {
    const [goalsRes, recRes] = await Promise.all([
      fetch(`${baseUrl}/goals`),
      fetch(`${baseUrl}/recommended`),
    ]);

    const goalsData = await goalsRes.json();
    const recData = await recRes.json();

    setGoals({
      calorie_goal: goalsData.calorie_goal,
      protein_goal: goalsData.protein_goal,
      calories_consumed: goalsData.calories_consumed,
      protein_consumed: goalsData.protein_consumed,
    });

    setLoggedFoods(goalsData.logged_foods);
    setRecommendations(recData);
  };

  React.useEffect(() => {
    refreshAll();
  }, []);

  // update goals
  const updateGoals = async (newGoals) => {
    await fetch(`${baseUrl}/set_goals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newGoals)
    });

    await refreshAll(); // always resync
  };

  //Remove food
  const removeFood = async (dish) => {
    const response = await fetch(`${baseUrl}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dish }),
    });

    const data = await response.json();
    if (!data.error) {
      setLoggedFoods(data.logged_foods); // update state
    } else {
      console.error(data.error);
    }

    await refreshAll(); // resync everything
  };

  // log food
  const addFood = async (dish) => {
    await fetch(`${baseUrl}/log_food`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ dish })
    });

    await refreshAll(); // everything updates automatically
  };

  return (
    <div style={{ marginTop: "4%" }}>
      <NutritionGoals 
        goals={goals}
        updateGoals={updateGoals}
      />

      <DisplayFoods 
        foods={loggedFoods}
        removeFood={removeFood}
         />

      <DisplayRecommendations 
        recommendations={recommendations}
        addFood={addFood}
      />
    </div>
  );
}

function NutritionGoals({ goals, updateGoals }) {
  const [calorieGoal, setCalorieGoal] = useState(goals.calorie_goal);
  const [proteinGoal, setProteinGoal] = useState(goals.protein_goal);

  React.useEffect(() => {
    setCalorieGoal(goals.calorie_goal);
    setProteinGoal(goals.protein_goal);
  }, [goals]);

  const calorieGap = Math.max(0, goals.calorie_goal - goals.calories_consumed);
  const proteinGap = Math.max(0, goals.protein_goal - goals.protein_consumed);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Nutrition Goals</h2>

      <div style={styles.grid}>
        <div style={styles.card}>
          <p style={styles.label}>Calorie Goal</p>
          <input
            type="number"
            value={calorieGoal}
            onChange={(e) => {
              const newCalorieGoal = Number(e.target.value);
              setCalorieGoal(newCalorieGoal);
              updateGoals({
                calorie_goal: newCalorieGoal,
                protein_goal: proteinGoal,
              });
            }}
            style={styles.input}
          />
        </div>

        <div style={styles.card}>
          <p style={styles.label}>Protein Goal</p>
          <input
            type="number"
            value={proteinGoal}
            onChange={(e) => {
              const newProteinGoal = Number(e.target.value);
              setProteinGoal(newProteinGoal);
              updateGoals({
                calorie_goal: calorieGoal,
                protein_goal: newProteinGoal,
              });
            }}
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <p style={styles.label}>Calories Remaining</p>
          <p style={styles.normal}>{calorieGap}</p>
        </div>

        <div style={styles.card}>
          <p style={styles.label}>Protein Remaining</p>
          <p style={styles.normal}>{proteinGap}g</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "500px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "sans-serif",
  },
  title: {
    textAlign: "center",
    marginBottom: "20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "15px",
    marginBottom: "20px",
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "15px",
    textAlign: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  },
  label: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "8px",
  },
  input: {
    width: "80%",
    padding: "8px",
    fontSize: "16px",
    textAlign: "center",
    borderRadius: "8px",
    border: "1px solid #ccc",
  },
  normal: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "green",
  },
  over: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "red",
  },
};



function DisplayFoods({ foods, removeFood }) {
  if (!foods || foods.length === 0) return null;

  return (
    <div style={food_styles.container}>
      <h2 style={food_styles.title}>Logged Foods</h2>

      <div style={food_styles.column}>
        {foods.map((food, index) => (
          <div key={index} style={food_styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={food_styles.name}>{food.name}</p>
                <p style={food_styles.sub}>
                  {food.calories} cal • {food.protein}g protein
                </p>
              </div>

              <button
                onClick={() => removeFood(food)}
                style={{
                  padding: "6px 10px",
                  backgroundColor: "#ff4d4d",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  alignSelf: "flex-start", // optional, keeps it top-aligned
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const food_styles = {
  container: {
    maxWidth: "500px",
    margin: "20px auto",
    fontFamily: "sans-serif",
  },
  title: {
    marginBottom: "10px",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: "10px",
    padding: "12px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  },
  name: {
    fontWeight: "600",
    margin: 0,
  },
  sub: {
    margin: "4px 0 0 0",
    color: "#666",
    fontSize: "14px",
  },
};

function DisplayRecommendations({ recommendations, addFood }) {
  if (!recommendations || recommendations.length === 0) {
    return <p style={{ textAlign: "center" }}>No recommendations</p>;
  }

  return (
    <div style={{ marginTop: "10%", textAlign: "center" }}>
      <h2>Recommended Dishes</h2>
      <DishRow dishes={recommendations} addFood={addFood} />
    </div>
  );
}


function GetGroups({tab}) {
  const [result, setResult] = useState(null);

  React.useEffect(() => {
    setResult(null) 
    const getGroups = async () => {
      const response = await fetch(`${baseUrl}/stations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tab })
      });

      const data = await response.json();
      console.log("API response:", data);
      setResult(data);
    };
   getGroups();
  }, [tab]);
  return (
    <div style={{ marginTop: "20px" }}>
      {result ? <DisplayStations data={result} /> : <p>Loading...</p>}
    </div>
  );
}


function DisplayStations({ data }) {
  if (!data.stations) return <p>No stations available</p>;

  return (
    <div>
      <h2>{data.period}</h2>

      {data.stations.map((station) => (
        <div key={station.station_id} style={{ marginBottom: "30px" }}>
          
          {/* Station Title */}
          <h3>{station.station_name}</h3>
          
          {/* Dishes */}
          <DishRow dishes={station.dishes} />
        </div>
      ))}
    </div>
  );
}

function DishRow({ dishes, addFood}) {
  return (
    <div style={{ display: "flex", overflowX: "auto", gap: "16px", padding: "10px" }}>
      {dishes.map(dish => (
        <DishCard key={dish.id} dish={dish} addFood={addFood} />
      ))}
    </div>
  );
}

function DishCard({ dish, addFood }) {
  const logFood = async () => {
    await fetch(`${baseUrl}/log_food`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ dish })
    });
  };
  return (
    <div style={{
      width: "200px",
      flex: "0 0 auto",
      border: "1px solid #ccc",
      borderRadius: "10px",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      <img
        src={dish.image || "https://via.placeholder.com/200"}
        alt=""
        style={{ width: "100%", height: "140px", objectFit: "cover" }}
      />

      <div style={{ padding: "10px", textAlign: "center" }}>
        <p style={{ fontWeight: "600" }}>{dish.name}</p>
        <p style={{ color: "#666" }}>{dish.calories} cal</p>
      </div>

      <div style={{ padding: "10px", marginTop: "auto" }}>
        <button
          onClick={() => (addFood || logFood)(dish)}
          style={{
            width: "100%",
            padding: "8px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "6px",
          }}
        >
          Add to Plan
        </button>
      </div>
    </div>
  );
}

function ImageLoader({ src, alt }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div style={{ width: "100%", position: "re" }}>
      {loading && !error && <p style={{ textAlign: "center" }}>Loading image...</p>}
      {error && <p style={{ textAlign: "center" }}>Failed to load image.</p>}

      {src && (
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "50vh",
            objectFit: "cover",
          }}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
        )}
        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "50%", // adjust how far the gradient goes
            background: "linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, white 100%)",
          }}
        />
      
    </div>
  );
}
const allFunctions = {Main};
export default allFunctions;
