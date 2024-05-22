const express = require('express');
const app = express();
const port = 3000;
const jwte = require('jwt-encode');
const jwtd = require('jwt-decode');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const secret = process.env.APP_SECRET;

const bcrypt = require('bcrypt');

// interface User 
// {
//     UserID : number,
//     Email : string,
//     Password : string,
//     FirstName : string,
//     LastName : string,
//     DOB : Date,
//     Address : string
// }

// interface Volcano
// {
//     id : number,
//     name : string,
//     country : string,
//     region : string,
//     subregion : string,
//     last_eruption : string,
//     summit : number,
//     elevation : number,
//     population_5km? : number,
//     population_10km? : number,
//     population_30km? : number,
//     population_100km? : number,
//     latitude : Number,
//     longitude : Number
// }

const knex = require('knex')({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'volcanoes',
    },
});


app.use(express.json());

function GetIsAuth(JWT)
{
   jwt.verify(JWT, process.env.SECRET_KEY, (err, decoded) => {
        if (err == undefined)
        {
            return true;
        }
        return false;
   })
}

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/me', (req, res) => {

    const me = {
        name: "Amelia Kirn",
        student_number: "n11247002"
    }
    res.send(me);
  })

app.get('/countries', (req, res) => {
    
    const data = knex.select('country').from('data').orderBy("country", "asc").distinct("country").then((d)=>
        {
            var carr = [];
            for (var i of d)
            {
                carr.push(i.country);
            }
            res.send(carr)
        });
})

app.get('/volcano/:id', (req, res) => {

    const Header = req.headers.authorization;
    var Auth = false;
    if (!Header)
    {
        Auth = GetIsAuth(Header)
    }

    knex.select('*').from('data').where("id", req.params.id).first().then((d)=>
    {
        if (d == undefined) { res.status(404); res.send({error:true, message:"Volcano with ID: " + req.params.id + " not found."})}
        res.send(d)
    });
})

app.get('/volcanoes', (req, res) => {
    
    if (req.query.country == undefined) {res.status(400); res.send({error:true, message:"Country is a required query parameter."}); return;}

    const data = knex.select('id', 'name', 'country', 'region', 'subregion').from('data').where("country", req.query.country)
    .then((d)=>
    {
        res.status(200);
        res.send(d)
    });
})

app.post('/user/register', (req, res) => {

    const Request = req.body;

    // If Request body invalid or not present
    if (Request.email == undefined || Request.password == undefined) 
    {
        res.status(400);
        res.send({error:true, message:"Request body incomplete, both email and password are required"})
        return;
    }

    // Check if user already exists
    knex.select('Email').from('users').where('Email', Request.email).first()
    .then((d) => {

        if (d != undefined) 
        {
            res.status(409);
            res.send({error:true, message:"User already exists"})
            return;
        }

        // User doesnt already exist create new user
        bcrypt.hash(Request.password, 10, (err, hash) => {
            
            knex.insert({Email: Request.email, Password: hash}).into("users")
            .then((d)=>
            {
                console.log("created");
                res.status(201);
                res.send({message: "User created"})
            });

        })
    }); 
})

app.post('/user/login', (req, res) => {

    const Request = req.body;
    // If Request body invalid or not present
    if (Request == undefined || Request.email == undefined || Request.password == undefined) 
    {
        res.status(400);
        res.send({error:true, message:"Request body incomplete, both email and password are required"})
        return;
    }

    knex.select("Email", "Password").from("users").where('Email', Request.email).first()
    .then((d) => {
        
        // Check if user exists
        if (d == undefined) {res.status(401); res.send({error:true, message:"Incorrect email or password"}); return;}

        // Construct JWT
        const IssueTime = Date.now();


        const jwtdata = {
            Email: Request.email
        }

        const jwt = jwte(jwtdata, secret);

        const Token = {
            token: jwt,
            token_type: "Bearer",
            expires_in: Date.now()
        }

        console.log(Token);

        // Compare Passwords
        bcrypt.compare(Request.password, d.Password, (err, result)=>{
            console.log(result);
            if (result == true)
            {
                res.status(200);
                res.send(Token);
                return;
            }
            res.status(401);
            res.send({error:true, message:"Incorrect email or password"})
        })
    })

    
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})