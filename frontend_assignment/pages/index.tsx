import detectEthereumProvider from "@metamask/detect-provider"
import {Strategy, ZkIdentity} from "@zk-kit/identity"
import {generateMerkleProof, Semaphore} from "@zk-kit/protocols"
import {providers} from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import {useForm, Controller} from 'react-hook-form';
import {Box, TextField, Button, Slider, Typography, Card, CircularProgress} from '@mui/material';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {yupResolver} from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import useSWR from 'swr'


export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const validationSchema = Yup.object().shape({
        nickname: Yup.string()
            .required('Nickname is actually required'),
        coolThing: Yup.string()
            .max(32, 'Must be no more that 32 symbols')
            .required('Come on, there must be something...'),
        trustLevel: Yup.number().lessThan(90, "Don't trust - verify").required("Don't trust, verify!"),
    });
    const {control, handleSubmit} = useForm({
        resolver: yupResolver(validationSchema),
    });
    const darkTheme = createTheme({
        palette: {
            mode: 'dark',
        },
    });

    const { data, error } = useSWR('/api/greetings', (...args) => fetch(...args).then(res => res.json()), {
        refreshInterval: 100
    })
    let greetings;
    if (error) greetings = <div>failed to load last greetings</div>
    if (data) {
        greetings = data?.map(function (greeting, idx: number) {
            return <Card key={idx} sx={{p: 2, width: 250, backgroundColor: '#90caf9'}}>
                <Typography color="darkblue">
                    @{greeting.from}
                </Typography>
                <Typography color="black">
                    {greeting.message}
                </Typography>
            </Card>
        });
    } else {
        greetings = <CircularProgress />;
    }

    async function greet(data: any) {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({method: "eth_requestAccounts"})

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = data.coolThing;

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting,
        )

        const {proof, publicSignals} = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                nickname: data.nickname,
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof,
            }),
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    function trustValueFormat(trust: number) {
       if (trust < 10) {
           return "Completely trust-less";
       } else if (trust < 40) {
           return "Semi-trusted";
       } else if (trust < 90) {
           return "Incentivized";
       } else {
           return "Trust-full";
       }
    }

    return (
        <ThemeProvider theme={darkTheme}>
            <div className={styles.container}>
                <Head>
                    <title>Greetings</title>
                    <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore."/>
                    <link rel="icon" href="/favicon.ico"/>
                </Head>

                <main className={styles.main}>
                    <h1 className={styles.title}>Greetings</h1>
                    <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>
                    <div className={styles.logs}>{logs}</div>
                    <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
                        <form onSubmit={handleSubmit((data, _) => greet(data))}>
                            <Box sx={{display: 'flex', flexDirection: 'column'}}>
                                <Controller
                                    name="nickname"
                                    control={control}
                                    rules={{validate: (f) => validationSchema.validate({f}).catch((e) => e.message)}}
                                    render={({field, fieldState: {error}}) =>
                                        <TextField {...field}
                                                   label={"Your totally secret nickname"}
                                                   className={styles.input}
                                                   variant="filled"
                                                   error={!!error}
                                                   helperText={error ? error.message : ""}
                                        />
                                    }/>
                                <Controller
                                    name="coolThing"
                                    control={control}
                                    rules={{validate: (f) => validationSchema.validate({f}).catch((e) => e.message)}}
                                    render={({field, fieldState: {error}}) =>
                                        <TextField {...field}
                                                   multiline={true}
                                                   minRows={3}
                                                   maxRows={4}
                                                   label={"Cool thing you want to share"}
                                                   className={styles.input}
                                                   variant="filled"
                                                   error={!!error}
                                                   helperText={error ? error.message : ""}
                                        />
                                    }/>
                                <Controller
                                    name="trustLevel"
                                    control={control}
                                    rules={{validate: (f) => validationSchema.validate({f}).catch((e) => e.message)}}
                                    render={({field, fieldState: {error}}) =>
                                        <Box>
                                            <Typography color={!!error ? "red" : "lightgray"}>
                                                How much do you trust this website?
                                            </Typography>
                                            <Slider {...field}
                                                    defaultValue={9}
                                                    getAriaValueText={trustValueFormat}
                                                    valueLabelFormat={trustValueFormat}
                                                    valueLabelDisplay="auto"
                                                    aria-labelledby="non-linear-slider"
                                            />
                                            <Typography color="red" fontSize={12}>
                                                {error?.message}
                                            </Typography>
                                        </Box>
                                    }/>
                                <Box sx={{m: 1}}/>
                                <Button variant="contained" type="submit" className={styles.button}>
                                    Greet
                                </Button>
                            </Box>
                        </form>
                        <Box sx={{m: 2}}/>
                        <Box>
                            <h3>Greetings:</h3>
                            {greetings}
                        </Box>
                    </Box>
                </main>
            </div>
        </ThemeProvider>
    );
}
