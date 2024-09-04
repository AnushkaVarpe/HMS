import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";
import moment from 'moment';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const patientsDb = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "patientsRegistered",
    password: "1234",
    port: 5432,
});
patientsDb.connect();

const hospitalDb = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "hospital_01",
    password: "1234",
    port: 5432,
});
hospitalDb.connect();

console.log('Connected to database:', hospitalDb.database);

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/contact', (req, res) => {
    res.render('contact');
});

app.get('/patient/login', (req, res) => {
    res.render('patient/patientLogin', { message: '' });
});
  
app.get('/patient/register', (req, res) => {
    res.render('patient/patientRegister', { message: '' });
});
  
app.get('/staff/login', (req, res) => {
    res.render('staff/staffLogin', { message: '' });
});
  
app.get('/staff/register', (req, res) => {
    res.render('staff/staffRegister', { message: '' });
});
  
app.get('/admin/login', (req, res) => {
    res.render('admin/adminLogin');
});
  
app.post('/patient/register', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;    
        patientsDb.query('SELECT * FROM patients_registered WHERE username = $1', [username], (err, result) => {
            if (err) {
                console.error('Error checking patient registration:', err);
                res.render('patient/patientRegister', { message: 'Error during registration. Please try again.' });
            } else if (result.rows.length > 0) {
                res.render('patient/patientRegister', { message: 'Username already exists. Please try a different one.' });
            } else {
                patientsDb.query('INSERT INTO patients_registered (username, password) VALUES ($1, $2)', [username, password], (err) => {
                    if (err) {
                        console.error('Error registering patient:', err);  // Log the error here
                        res.render('patient/patientRegister', { message: 'Error during registration. Please try again.' });
                    } else {
                        res.redirect('/patient/login');
                    }
                });
            }
        });
    });
    

app.post('/patient/login', (req, res) => {
    const { username, password } = req.body;

    patientsDb.query('SELECT * FROM patients_registered WHERE username = $1 AND password = $2', [username, password], (err, result) => {
        if (err) {
            console.error('Error during patient login:', err);
            res.render('patient/patientLogin', { message: 'Error during login. Please try again.' });
        } else if (result.rows.length > 0) {
            res.redirect('/patient/home');
        } else {
            res.render('patient/patientRegister', { message: 'Invalid credentials/ user does not exist. Please register.' });
        }
    });
});


app.get('/patient/home', (req, res) => {
    res.render('patient/patientHome');
});

app.get('/patient/emergency',(req,res)=>{
    res.render('patient/patientEmergency');
});

app.get('/admin/home', async (req, res) => {
    try {
        let medicinesData = [];
        let inventoryData = [];
        const dbName = 'hospital_01';

        // Fetch medicines data
        const medicinesQuery = `SELECT id, name, stock, expiry FROM hospital.medicines ORDER BY id`;
        const medicinesResult = await hospitalDb.query(medicinesQuery);
        console.log('Medicines Query Result:', medicinesResult.rows);  // Log the rows directly
        medicinesData.push({ hospital: dbName, data: medicinesResult.rows });

        // Fetch inventory data
        const inventoryQuery = `SELECT id, itemname, stock FROM hospital.inventory ORDER BY id`;
        const inventoryResult = await hospitalDb.query(inventoryQuery);
        console.log('Inventory Query Result:', inventoryResult.rows);  // Log the rows directly
        inventoryData.push({ hospital: dbName, data: inventoryResult.rows });

        // Render the page
        res.render('admin/adminHome', { medicinesData, inventoryData });

    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Server Error');
    }
});


app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'password') {
        res.render('admin/adminHome', { medicinesData, inventoryData });

    } else {
        res.render('admin/adminLogin');
    }
});

app.post('/staff/register', (req, res) => {
    const { username, password, name, role } = req.body;

    hospitalDb.query('SELECT * FROM hospital.staff_registered WHERE username = $1', [username], (err, result) => {
        if (err) {
            console.error('Error checking staff registration:', err);
            res.render('staff/staffRegister', { message: 'Error during registration. Please try again.' });
        } else if (result.rows.length > 0) {
            res.render('staff/staffRegister', { message: 'Username already exists. Please try a different one.' });
        } else {
            hospitalDb.query('INSERT INTO hospital.staff_registered (name, role, username, password) VALUES ($1, $2, $3, $4)', [name, role, username, password], (err) => {
                if (err) {
                    console.error('Error registering staff:', err);
                    res.render('staff/staffRegister', { message: 'Error during registration. Please try again.' });
                } else {
                    res.redirect('/staff/login');
                }
            });
        }
    });
});

app.post('/staff/login', (req, res) => {
    const { username, password } = req.body;

    hospitalDb.query('SELECT * FROM hospital.staff_registered WHERE username = $1 AND password = $2', [username, password], (err, result) => {
        if (err) {
            console.error('Error during staff login:', err);
            res.render('staff/staffLogin', { message: 'Error during login. Please try again.' });
        } else if (result.rows.length > 0) {
            res.redirect('/staff/home');
        } else {
            res.render('staff/staffRegister', { message: 'Invalid credentials/ user does not exist. Please register.' });
        }
    });
});

app.post('/update-medicine', (req, res) => {
    const medicineId = req.body.medicineId;
    const additionalStock = parseInt(req.body.medQuantity, 10);
    const newExpiry = moment(req.body.expiry, 'DD-MM-YYYY').format('YYYY-MM-DD');

    // Fetch the current stock for the medicine
    hospitalDb.query('SELECT stock FROM hospital.medicines WHERE id = $1', [medicineId], (err, result) => {
        if (err) {
            console.error('Error fetching current stock:', err);
            res.status(500).send('Internal Server Error');
        } else if (result.rows.length === 0) {
            res.status(404).send('Medicine not found');
        } else {
            const currentStock = result.rows[0].stock;
            const newStock = currentStock + additionalStock;

            // Update the medicine with the new stock value and expiry date
            hospitalDb.query(
                'UPDATE hospital.medicines SET stock = $1, expiry = $2 WHERE id = $3',
                [newStock, newExpiry, medicineId],
                (err) => {
                    if (err) {
                        console.error('Error updating medicine:', err);
                        res.status(500).send('Internal Server Error');
                    } else {
                        res.redirect('/view-medicines');
                    }
                }
            );
        }
    });
});


app.post('/update-inventory', (req, res) => {
    const inventoryId = req.body.inventoryId;
    const additionalStock = parseInt(req.body.invQuantity, 10);

    // Fetch the current stock for the item
    hospitalDb.query('SELECT stock FROM hospital.inventory WHERE id = $1', [inventoryId], (err, result) => {
        if (err) {
            console.error('Error fetching current stock:', err);
            res.status(500).send('Internal Server Error');
        } else if (result.rows.length === 0) {
            res.status(404).send('Inventory item not found');
        } else {
            const currentStock = result.rows[0].stock;
            const newStock = currentStock + additionalStock;

            // Update the inventory with the new stock value
            hospitalDb.query(
                'UPDATE hospital.inventory SET stock = $1 WHERE id = $2',
                [newStock, inventoryId],
                (err) => {
                    if (err) {
                        console.error('Error updating inventory:', err);
                        res.status(500).send('Internal Server Error');
                    } else {
                        res.redirect('/view-inventory');
                    }
                }
            );
        }
    });
});


app.get('/view-medicines', (req, res) => {
    hospitalDb.query('SELECT * FROM hospital.medicines ORDER BY id', (err, result) => {
        if (err) {
            console.error('Error fetching medicines:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.render('staff/viewMeds', { medicines: result.rows });
        }
    });
});

app.get('/view-inventory', (req, res) => {
    hospitalDb.query('SELECT id, itemName, stock FROM hospital.inventory ORDER BY id', (err, result) => {
        if (err) {
            console.error('Error fetching inventory:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.render('staff/viewInv', { inventory: result.rows });
        }
    });
});

app.get('/staff/beds', (req, res) => {
    res.render('staff/staffBeds');
});

app.get('/staff/medicines', (req, res) => {
    res.render('staff/staffMeds');
});

app.get('/staff/inventory', (req, res) => {
    res.render('staff/staffInv');
});

app.get('/staff/home', (req, res) => {
    res.render('staff/staffHome');
});

app.get('/patient/opd', async (req, res) => {
    try {
        const hospitals = await hospitalDb.query('SELECT hospital_id AS id, name FROM hospital.hospitals_local');
        console.log(hospitals.rows); // Check the output in your terminal
        res.render('patient/patientOPD', { hospitals: hospitals.rows });
    } catch (err) {
        console.error('Error fetching hospitals:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Fetch hospitals to display in the dropdown
app.get('/hospitals', async (req, res) => {
    try {
        const hospitals = await hospitalDb.query('SELECT hospital_id AS id, name FROM hospital.hospitals_local');
        res.render('appointment', { hospitals: hospitals.rows });
    } catch (err) {
        console.error('Error fetching hospitals:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Fetch doctors based on the selected hospital
app.post('/getDoctors', async (req, res) => {
    try {
        const { hospitalId } = req.body;
        const doctors = await hospitalDb.query('SELECT id, name FROM hospital.doctors WHERE hospital_id = $1', [hospitalId]);
        res.json(doctors.rows);
    } catch (err) {
        console.error('Error fetching doctors:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
