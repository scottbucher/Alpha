export class UserDataResults {
    userData: UserData[];
    stats: Stats;

    constructor(userDataRows: UserData[], statsRow: Stats) {
        this.userData = userDataRows;
        this.stats = statsRow;
    }
}

export interface Stats {
    TotalItems: number;
    TotalPages: number;
}

export interface UserData {
    XpAmount: number;
    UserDiscordId: string;
}
